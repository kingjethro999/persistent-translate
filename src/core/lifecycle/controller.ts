import { collectText, eligible, Patcher } from '../dom/text';
import { language, siteKey } from '../domain/site-key';
import { validResult } from '../messaging/protocol';
import type { TranslationJob, TranslationResult } from '../translate/engine';
export interface Config {
  sourceLanguage: string;
  targetLanguage: string;
}
export interface PageState {
  status: string;
  translated: number;
  detail?: string;
  sourceLanguage?: string;
}
export class ContentController {
  readonly documentId = crypto.randomUUID();
  private epoch = 0;
  private routeEpoch = 0;
  private href: string;
  private config: Config | null = null;
  private patcher = new Patcher();
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private roots = new Set<Node>();
  private running = false;
  private applied = 0;
  private state: PageState = { status: 'disabled', translated: 0 };
  private cache = new Map<string, string>();
  constructor(
    private doc: Document,
    private translate: (job: TranslationJob) => Promise<TranslationResult>,
    private publish: (state: PageState) => void = () => {},
  ) {
    this.href = doc.location.href;
  }
  getState(): PageState {
    return this.state;
  }
  private report(status: string, detail?: string): void {
    this.state = {
      status,
      translated: this.applied,
      detail,
      sourceLanguage: this.config?.sourceLanguage,
    };
    this.publish(this.state);
  }
  configure(config: Config): void {
    this.stop(true);
    this.applied = 0;
    if (!this.doc.documentElement) {
      this.observer = new MutationObserver(() => {
        if (this.doc.documentElement) this.configure(config);
      });
      this.observer.observe(this.doc, { childList: true });
      return;
    }
    const hint = this.doc.documentElement.lang;
    const source =
      config.sourceLanguage === 'auto'
        ? language(hint)
          ? hint
          : ''
        : config.sourceLanguage;
    if (!language(source)) {
      this.report(
        'detecting',
        'Choose the page language; its language is uncertain.',
      );
      return;
    }
    this.config = { ...config, sourceLanguage: source };
    if (
      source.toLowerCase().split('-')[0] ===
      config.targetLanguage.toLowerCase().split('-')[0]
    ) {
      this.report('ready', 'Page language already matches target.');
      return;
    }
    this.observer = new MutationObserver((records) => {
      this.checkRoute();
      for (const record of records) {
        if (record.type === 'childList') {
          for (const node of record.addedNodes) this.enqueue(node);
        } else if (record.type === 'characterData') {
          if (
            this.config &&
            eligible(
              record.target as Text,
              this.config.sourceLanguage,
              this.config.targetLanguage,
            ) &&
            this.patcher.source(record.target as Text) !== null
          )
            this.enqueue(record.target);
        } else this.enqueue(record.target);
      }
    });
    this.observer.observe(this.doc.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'lang',
        'translate',
        'class',
        'style',
        'hidden',
        'aria-hidden',
        'contenteditable',
      ],
    });
    this.doc.defaultView?.addEventListener('popstate', this.onRoute);
    this.doc.defaultView?.addEventListener('hashchange', this.onRoute);
    this.enqueue(this.doc.body ?? this.doc.documentElement);
  }
  private onRoute = () => {
    this.checkRoute();
    this.enqueue(this.doc.body ?? this.doc.documentElement);
  };
  private checkRoute(): void {
    if (this.href !== this.doc.location.href) {
      this.href = this.doc.location.href;
      this.routeEpoch++;
      this.epoch++;
      this.roots.clear();
      this.enqueue(this.doc.body ?? this.doc.documentElement);
    }
  }
  private enqueue(root: Node): void {
    if (!this.config) return;
    if (this.roots.size >= 32) {
      this.roots.clear();
      this.roots.add(this.doc.body ?? this.doc.documentElement);
    } else this.roots.add(root);
    if (!this.running && this.timer === undefined)
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.drain();
      }, 16);
  }
  private async drain(): Promise<void> {
    if (this.running || !this.config) return;
    this.running = true;
    const config = this.config,
      epoch = this.epoch,
      route = this.routeEpoch;
    const nodes = new Set<Text>();
    for (const root of this.roots) {
      if (root.isConnected)
        for (const node of collectText(
          root,
          config.sourceLanguage,
          config.targetLanguage,
        )) {
          if (this.patcher.source(node) !== null) nodes.add(node);
          if (nodes.size >= 2000) break;
        }
    }
    this.roots.clear();
    try {
      const pending = [...nodes];
      let partial = nodes.size >= 2000;
      while (pending.length && this.config === config && epoch === this.epoch) {
        const batch: {
          node: Text;
          original: string;
          trimmed: string;
          id: string;
        }[] = [];
        let chars = 0;
        while (pending.length && batch.length < 32) {
          const node = pending[0]!,
            original = this.patcher.source(node);
          if (original === null || !original.trim()) {
            pending.shift();
            continue;
          }
          if (chars + original.trim().length > 12000 && batch.length) break;
          pending.shift();
          chars += original.trim().length;
          batch.push({
            node,
            original,
            trimmed: original.trim(),
            id: String(batch.length),
          });
        }
        if (!batch.length) break;
        this.report('translating');
        const unique = new Map<string, string>();
        for (const item of batch)
          if (!this.cache.has(item.trimmed) && !unique.has(item.trimmed))
            unique.set(item.trimmed, item.id);
        const job: TranslationJob = {
          requestId: crypto.randomUUID(),
          documentId: this.documentId,
          documentEpoch: epoch,
          routeEpoch: route,
          originKey: siteKey(this.href) ?? 'https://invalid.test',
          provider: 'chrome-native',
          sourceLanguage: config.sourceLanguage,
          targetLanguage: config.targetLanguage,
          segments: [...unique].map(([text, id]) => ({ id, text })),
        };
        if (job.segments.length) {
          const result = await this.translate(job);
          if (!validResult(result, job)) throw new Error('bad_response');
          this.checkRoute();
          if (
            this.config !== config ||
            epoch !== this.epoch ||
            route !== this.routeEpoch
          )
            break;
          result.segments.forEach((s, i) => {
            if (this.cache.size >= 500)
              this.cache.delete(this.cache.keys().next().value!);
            this.cache.set(job.segments[i]!.text, s.translatedText);
          });
        }
        for (const item of batch) {
          const output = this.cache.get(item.trimmed);
          if (
            output !== undefined &&
            eligible(item.node, config.sourceLanguage, config.targetLanguage)
          ) {
            const prefix = item.original.slice(
              0,
              item.original.indexOf(item.trimmed),
            );
            const suffix = item.original.slice(
              prefix.length + item.trimmed.length,
            );
            if (
              this.patcher.apply(
                item.node,
                item.original,
                prefix + output + suffix,
              )
            )
              this.applied++;
            else partial = true;
          }
        }
      }
      if (this.config === config && epoch === this.epoch)
        this.report(partial ? 'partially-translated' : 'translated');
    } catch (error) {
      if (this.config === config && epoch === this.epoch) {
        this.roots.clear();
        this.observer?.disconnect();
        const code =
          error instanceof Error
            ? error.message.split(':')[0]
            : 'unknown_error';
        this.report(
          code === 'provider_unavailable' || code === 'model_prepare_required'
            ? 'provider-unavailable'
            : 'error',
          code,
        );
      }
    } finally {
      this.running = false;
      if (this.roots.size && this.config)
        this.enqueue(this.doc.body ?? this.doc.documentElement);
    }
  }
  stop(restore = false): void {
    this.config = null;
    this.epoch++;
    this.observer?.disconnect();
    this.observer = null;
    this.doc.defaultView?.removeEventListener('popstate', this.onRoute);
    this.doc.defaultView?.removeEventListener('hashchange', this.onRoute);
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.roots.clear();
    this.cache.clear();
    if (restore) this.patcher.restore();
    this.report('paused');
  }
}
