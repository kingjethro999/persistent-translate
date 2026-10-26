import type {
  EngineState,
  Pair,
  TranslationEngine,
  TranslationJob,
  TranslationResult,
} from './engine';

export interface NativeTranslator {
  translate(text: string, options?: { signal?: AbortSignal }): Promise<string>;
  destroy(): void;
}

interface CreateMonitor {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: { loaded: number }) => void,
  ): void;
}

export interface NativeTranslatorFactory {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<string>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    signal?: AbortSignal;
    monitor?: (monitor: CreateMonitor) => void;
  }): Promise<NativeTranslator>;
}

type ErrorCode =
  | 'provider_unavailable'
  | 'unsupported_pair'
  | 'model_prepare_required'
  | 'model_download_failed'
  | 'provider_timeout'
  | 'rate_limited'
  | 'bad_response'
  | 'canceled';

const messages: Record<ErrorCode, string> = {
  provider_unavailable:
    'On-device translation is unavailable in this browser context.',
  unsupported_pair:
    'This language pair is unavailable. Choose a supported source and target language.',
  model_prepare_required:
    'Open translation setup and click Prepare language model for this pair.',
  model_download_failed:
    'The language model could not be prepared. Check connectivity and try again.',
  provider_timeout: 'The on-device translation engine timed out. Try again.',
  rate_limited:
    'The on-device engine is busy. Try again after the current work finishes.',
  bad_response: 'The translation engine received or returned an invalid batch.',
  canceled: 'Translation was canceled.',
};

export class NativeEngineError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(messages[code]);
    this.name = 'NativeEngineError';
    this.code = code;
  }
}

interface NativeEngineOptions {
  api?: NativeTranslatorFactory | null;
  hasUserActivation?: () => boolean;
  timeoutMs?: number;
  preparationTimeoutMs?: number;
  maxPairs?: number;
}

interface TranslatorEntry {
  promise: Promise<NativeTranslator>;
  translator?: NativeTranslator;
  busy: number;
}

function probeFactory(): NativeTranslatorFactory | null {
  const candidate = (
    globalThis as typeof globalThis & { Translator?: NativeTranslatorFactory }
  ).Translator;
  return candidate &&
    typeof candidate.availability === 'function' &&
    typeof candidate.create === 'function'
    ? candidate
    : null;
}

function canonicalPair(pair: Pair): Pair {
  try {
    if (pair.source === 'auto' || !pair.source || !pair.target)
      throw new Error();
    const source = Intl.getCanonicalLocales(pair.source)[0];
    const target = Intl.getCanonicalLocales(pair.target)[0];
    if (!source || !target) throw new Error();
    return { source, target };
  } catch {
    throw new NativeEngineError('unsupported_pair');
  }
}

function pairKey(pair: Pair): string {
  return `${pair.source}:${pair.target}`;
}

/** Runs only in an extension document; never contacts a translation server. */
export class NativeChromeEngine implements TranslationEngine {
  readonly id = 'chrome-native' as const;
  private readonly api: NativeTranslatorFactory | null;
  private readonly activated: () => boolean;
  private readonly timeoutMs: number;
  private readonly preparationTimeoutMs: number;
  private readonly maxPairs: number;
  private readonly entries = new Map<string, TranslatorEntry>();
  private readonly lifetime = new AbortController();
  private tail: Promise<unknown> = Promise.resolve();
  private queued = 0;

  constructor(options: NativeEngineOptions = {}) {
    this.api = options.api === undefined ? probeFactory() : options.api;
    this.activated =
      options.hasUserActivation ??
      (() => globalThis.navigator?.userActivation?.isActive === true);
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.preparationTimeoutMs = options.preparationTimeoutMs ?? 300_000;
    this.maxPairs = Math.max(1, Math.min(4, options.maxPairs ?? 3));
  }

  async isAvailable(input: Pair): Promise<boolean> {
    if (!this.api || this.lifetime.signal.aborted) return false;
    try {
      const pair = canonicalPair(input);
      if (this.entries.get(pairKey(pair))?.translator) return true;
      return (
        (await this.deadline(() =>
          this.api!.availability({
            sourceLanguage: pair.source,
            targetLanguage: pair.target,
          }),
        )) === 'available'
      );
    } catch {
      return false;
    }
  }

  async prepare(
    input: Pair,
    onState?: (state: EngineState, progress?: number) => void,
  ): Promise<void> {
    // Capture the invocation gesture before asynchronous availability checks.
    const allowDownload = this.activated();
    try {
      await this.getTranslator(canonicalPair(input), allowDownload, onState);
      onState?.('ready', 1);
    } catch (error) {
      onState?.(
        error instanceof NativeEngineError &&
          [
            'provider_unavailable',
            'unsupported_pair',
            'model_prepare_required',
          ].includes(error.code)
          ? 'provider-unavailable'
          : 'error',
      );
      throw error;
    }
  }

  async translate(
    input: TranslationJob,
    signal?: AbortSignal,
  ): Promise<TranslationResult> {
    this.assertActive(signal);
    this.validateBatch(input);
    const pair = canonicalPair({
      source: input.sourceLanguage,
      target: input.targetLanguage,
    });
    if (this.queued >= 8) throw new NativeEngineError('rate_limited');
    const job = {
      ...input,
      segments: input.segments.map((segment) => ({ ...segment })),
    };
    this.queued += 1;
    const task = this.tail.then(async () => {
      this.assertActive(signal);
      const segments: TranslationResult['segments'] = [];
      if (pair.source === pair.target) {
        for (const segment of job.segments)
          segments.push({ id: segment.id, translatedText: segment.text });
      } else {
        const translator = await this.getTranslator(pair, false);
        this.assertActive(signal);
        const key = pairKey(pair);
        const entry = this.entries.get(key)!;
        entry.busy += 1;
        try {
          let outputSize = 0;
          for (const segment of job.segments) {
            this.assertActive(signal);
            const translatedText = await this.deadline(
              (operationSignal) =>
                translator.translate(segment.text, { signal: operationSignal }),
              this.timeoutMs,
              signal,
            );
            this.assertActive(signal);
            if (
              typeof translatedText !== 'string' ||
              !translatedText.trim() ||
              translatedText.length > 20_000
            ) {
              throw new NativeEngineError('bad_response');
            }
            outputSize += translatedText.length;
            if (outputSize > 48_000)
              throw new NativeEngineError('bad_response');
            segments.push({ id: segment.id, translatedText });
          }
        } catch (error) {
          if (
            error instanceof NativeEngineError &&
            ['provider_timeout', 'canceled'].includes(error.code)
          ) {
            this.removeEntry(key, entry);
          }
          throw error instanceof NativeEngineError
            ? error
            : new NativeEngineError('provider_unavailable');
        } finally {
          entry.busy -= 1;
        }
      }
      return {
        requestId: job.requestId,
        documentId: job.documentId,
        documentEpoch: job.documentEpoch,
        routeEpoch: job.routeEpoch,
        segments,
      };
    });
    this.tail = task.catch(() => undefined);
    try {
      return await task;
    } finally {
      this.queued -= 1;
    }
  }

  dispose(): void {
    this.lifetime.abort();
    for (const [key, entry] of this.entries) this.removeEntry(key, entry);
  }

  private validateBatch(job: TranslationJob): void {
    if (
      job.provider !== 'chrome-native' ||
      !Array.isArray(job.segments) ||
      job.segments.length === 0 ||
      job.segments.length > 32
    )
      throw new NativeEngineError('bad_response');
    let total = 0;
    const ids = new Set<string>();
    for (const segment of job.segments) {
      if (
        !segment ||
        typeof segment.id !== 'string' ||
        ids.has(segment.id) ||
        typeof segment.text !== 'string' ||
        !segment.text.trim() ||
        segment.text.length > 5_000
      ) {
        throw new NativeEngineError('bad_response');
      }
      ids.add(segment.id);
      total += segment.text.length;
    }
    if (total > 12_000) throw new NativeEngineError('bad_response');
  }

  private assertActive(signal?: AbortSignal): void {
    if (signal?.aborted) throw new NativeEngineError('canceled');
    if (!this.api || this.lifetime.signal.aborted)
      throw new NativeEngineError('provider_unavailable');
  }

  private async getTranslator(
    pair: Pair,
    allowDownload: boolean,
    onState?: (state: EngineState, progress?: number) => void,
  ): Promise<NativeTranslator> {
    this.assertActive();
    const key = pairKey(pair);
    const cached = this.entries.get(key);
    if (cached) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached.promise;
    }
    const options = {
      sourceLanguage: pair.source,
      targetLanguage: pair.target,
    };
    let availability: string;
    try {
      availability = await this.deadline(() => this.api!.availability(options));
    } catch (error) {
      throw error instanceof NativeEngineError
        ? error
        : new NativeEngineError('provider_unavailable');
    }
    this.assertActive();
    if (
      availability === 'unavailable' ||
      !['available', 'downloadable', 'downloading'].includes(availability)
    ) {
      throw new NativeEngineError('unsupported_pair');
    }
    if (availability !== 'available' && !allowDownload)
      throw new NativeEngineError('model_prepare_required');
    // Another request may have created the same pair during the availability check.
    const pending = this.entries.get(key);
    if (pending) return pending.promise;
    if (this.entries.size >= this.maxPairs) {
      const oldest = [...this.entries].find(
        ([, entry]) => entry.translator && entry.busy === 0,
      );
      if (!oldest) throw new NativeEngineError('rate_limited');
      this.removeEntry(...oldest);
    }
    if (availability !== 'available') onState?.('downloading-model', 0);
    const entry: TranslatorEntry = {
      busy: 0,
      promise: this.deadline(
        async (operationSignal) => {
          const translator = await this.api!.create({
            ...options,
            signal: operationSignal,
            monitor: (monitor) =>
              monitor.addEventListener('downloadprogress', (event) => {
                if (!operationSignal.aborted && Number.isFinite(event.loaded)) {
                  onState?.(
                    'downloading-model',
                    Math.max(0, Math.min(1, event.loaded)),
                  );
                }
              }),
          });
          if (this.entries.get(key) !== entry || operationSignal.aborted) {
            translator.destroy();
            throw new NativeEngineError('canceled');
          }
          if (
            !translator ||
            typeof translator.translate !== 'function' ||
            typeof translator.destroy !== 'function'
          ) {
            throw new NativeEngineError('bad_response');
          }
          entry.translator = translator;
          return translator;
        },
        allowDownload ? this.preparationTimeoutMs : this.timeoutMs,
      ),
    };
    this.entries.set(key, entry);
    entry.promise = entry.promise.catch((error: unknown) => {
      this.removeEntry(key, entry);
      throw error instanceof NativeEngineError
        ? error
        : new NativeEngineError('model_download_failed');
    });
    return entry.promise;
  }

  private removeEntry(key: string, entry: TranslatorEntry): void {
    if (this.entries.get(key) === entry) this.entries.delete(key);
    const translator = entry.translator;
    entry.translator = undefined;
    try {
      translator?.destroy();
    } catch {
      /* Best-effort release; do not reveal native details. */
    }
  }

  private deadline<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs = this.timeoutMs,
    signal?: AbortSignal,
  ): Promise<T> {
    const controller = new AbortController();
    return new Promise<T>((resolve, reject) => {
      const finish = (callback: () => void) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        this.lifetime.signal.removeEventListener('abort', cancel);
        callback();
      };
      const cancel = () => {
        controller.abort();
        finish(() => reject(new NativeEngineError('canceled')));
      };
      const timer = setTimeout(() => {
        controller.abort();
        finish(() => reject(new NativeEngineError('provider_timeout')));
      }, timeoutMs);
      signal?.addEventListener('abort', cancel, { once: true });
      this.lifetime.signal.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted || this.lifetime.signal.aborted) {
        cancel();
        return;
      }
      Promise.resolve()
        .then(() => operation(controller.signal))
        .then(
          (value) => finish(() => resolve(value)),
          (error: unknown) => finish(() => reject(error)),
        );
    });
  }
}
