import type { Config } from '../lifecycle/controller';
import { language, siteKey } from '../domain/site-key';
import { record } from '../messaging/protocol';
export interface TabSession {
  pausedDocumentId?: string;
  once?: { origin: string; documentId?: string; config: Config };
}
export interface SessionStore {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}
// Browser-owned session memory survives MV3 suspension; it never holds page text.
export class TabSessions {
  private pending = new Map<number, Promise<void>>();
  constructor(private storage: SessionStore) {}
  private key(tabId: number) {
    return `tab-session:${tabId}`;
  }
  private enqueue<T>(tabId: number, operation: () => Promise<T>): Promise<T> {
    const task = (this.pending.get(tabId) ?? Promise.resolve()).then(operation);
    const barrier = task.then(
      () => {},
      () => {},
    );
    this.pending.set(tabId, barrier);
    void barrier.then(() => {
      if (this.pending.get(tabId) === barrier) this.pending.delete(tabId);
    });
    return task;
  }
  private async read(tabId: number): Promise<TabSession> {
    const raw = (await this.storage.get(this.key(tabId)))[this.key(tabId)];
    if (!record(raw)) return {};
    const state: TabSession = {};
    if (
      typeof raw.pausedDocumentId === 'string' &&
      raw.pausedDocumentId.length <= 100
    )
      state.pausedDocumentId = raw.pausedDocumentId;
    const once = raw.once;
    if (
      record(once) &&
      typeof once.origin === 'string' &&
      siteKey(once.origin) === once.origin &&
      record(once.config) &&
      language(once.config.sourceLanguage, true) &&
      language(once.config.targetLanguage) &&
      (once.documentId === undefined ||
        (typeof once.documentId === 'string' && once.documentId.length <= 100))
    ) {
      state.once = {
        origin: once.origin,
        documentId: once.documentId,
        config: {
          sourceLanguage: once.config.sourceLanguage,
          targetLanguage: once.config.targetLanguage,
        },
      };
    }
    return state;
  }
  get(tabId: number): Promise<TabSession> {
    return this.enqueue(tabId, () => this.read(tabId));
  }
  forDocument(
    tabId: number,
    origin: string,
    documentId: string,
  ): Promise<TabSession> {
    return this.enqueue(tabId, async () => {
      const state = await this.read(tabId);
      if (
        state.once?.origin === origin &&
        state.once.documentId === undefined
      ) {
        state.once.documentId = documentId;
        await this.storage.set({ [this.key(tabId)]: state });
      }
      return state;
    });
  }
  set(tabId: number, state: TabSession): Promise<void> {
    const snapshot = structuredClone(state);
    return this.enqueue(tabId, () =>
      this.storage.set({ [this.key(tabId)]: snapshot }),
    );
  }
  clear(tabId: number): Promise<void> {
    return this.enqueue(tabId, () => this.storage.remove(this.key(tabId)));
  }
  clearOnce(tabId: number, origin?: string): Promise<void> {
    return this.enqueue(tabId, async () => {
      const state = await this.read(tabId);
      if (!state.once || (origin !== undefined && state.once.origin !== origin))
        return;
      delete state.once;
      await this.storage.set({ [this.key(tabId)]: state });
    });
  }
}
