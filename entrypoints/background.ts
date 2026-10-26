import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { hostPattern, siteKey } from '../src/core/domain/site-key';
import { RuleRepository } from '../src/core/rules/repository';
import { TabSessions } from '../src/core/rules/tab-session';
import {
  isTranslationJob,
  isUiCommand,
  record,
  validResult,
  type Reply,
  type UiCommand,
} from '../src/core/messaging/protocol';
import type { Config } from '../src/core/lifecycle/controller';
import type { TranslationJob } from '../src/core/translate/engine';
export default defineBackground(() => {
  const repo = new RuleRepository(
    {
      read: async () =>
        (await browser.storage.local.get('preferences')).preferences,
      write: async (p) => browser.storage.local.set({ preferences: p }),
    },
    browser.i18n.getUILanguage(),
  );
  const sessions = new TabSessions({
    get: async (key) => browser.storage.session.get(key),
    set: async (values) => browser.storage.session.set(values),
    remove: async (key) => browser.storage.session.remove(key),
  });
  let registrations: Promise<unknown> = Promise.resolve();
  let selectedEngineId: string | undefined;
  const access = async (origin: string) =>
    browser.permissions.contains({ origins: [hostPattern(origin)] });
  const notify = async (type = 'REFRESH_CONFIG') => {
    const tabs = await browser.tabs.query({});
    await Promise.allSettled(
      tabs
        .filter((t) => t.id !== undefined)
        .map((t) => browser.tabs.sendMessage(t.id!, { type }, { frameId: 0 })),
    );
  };
  const clearManualOverrides = async (origin?: string) => {
    const tabs = await browser.tabs.query({});
    await Promise.all(
      tabs
        .filter((t) => t.id !== undefined)
        .map((t) => sessions.clearOnce(t.id!, origin)),
    );
  };
  const reconcile = () => {
    registrations = registrations
      .catch(() => {})
      .then(async () => {
        const prefs = await repo.get();
        const matches = new Set<string>();
        for (const rule of Object.values(prefs.perOriginRules))
          if (
            rule.enabled &&
            !prefs.excludedOrigins.includes(rule.key) &&
            (await access(rule.key))
          )
            matches.add(hostPattern(rule.key));
        const registered = await browser.scripting.getRegisteredContentScripts({
          ids: ['persistent-sites'],
        });
        if (!matches.size) {
          if (registered.length)
            await browser.scripting.unregisterContentScripts({
              ids: ['persistent-sites'],
            });
          return;
        }
        const options = {
          id: 'persistent-sites',
          matches: [...matches],
          js: ['content-scripts/content.js'],
          runAt: 'document_start' as const,
          allFrames: false,
          persistAcrossSessions: true,
        };
        if (registered.length)
          await browser.scripting.updateContentScripts([options]);
        else await browser.scripting.registerContentScripts([options]);
      });
    return registrations;
  };
  async function configFor(
    tabId: number,
    url: string,
    documentId: string,
  ): Promise<Config | null> {
    const origin = siteKey(url);
    const session = origin
      ? await sessions.forDocument(tabId, origin, documentId)
      : {};
    if (
      !origin ||
      session.pausedDocumentId === documentId ||
      session.pausedDocumentId === '*'
    )
      return null;
    const manual = session.once;
    if (
      manual &&
      manual.origin === origin &&
      (manual.documentId === undefined || manual.documentId === documentId)
    ) {
      return manual.config;
    }
    const prefs = await repo.get();
    const rule = prefs.perOriginRules[origin];
    if (
      !(await access(origin)) ||
      prefs.excludedOrigins.includes(origin) ||
      !rule?.enabled
    )
      return null;
    return {
      sourceLanguage: rule.sourceLanguage,
      targetLanguage: rule.targetLanguage,
    };
  }
  async function getTab(tabId: number) {
    const tab = await browser.tabs.get(tabId);
    const origin = siteKey(tab.url ?? '');
    if (!origin) throw new Error('unsupported_url');
    return { tab, origin };
  }
  async function inject(tabId: number) {
    await browser.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      files: ['/content-scripts/content.js'],
    });
    await browser.tabs.sendMessage(
      tabId,
      { type: 'REFRESH_CONFIG' },
      { frameId: 0 },
    );
  }
  async function engine(job: TranslationJob) {
    if (!selectedEngineId) {
      const ping: unknown = await browser.runtime
        .sendMessage({ type: 'ENGINE_PING' })
        .catch(() => null);
      if (
        record(ping) &&
        ping.ok &&
        record(ping.value) &&
        typeof ping.value.engineId === 'string'
      )
        selectedEngineId = ping.value.engineId;
    }
    if (!selectedEngineId) throw new Error('provider_unavailable');
    const result: unknown = await browser.runtime
      .sendMessage({
        type: 'ENGINE_TRANSLATE',
        engineId: selectedEngineId,
        job,
      })
      .catch(() => {
        selectedEngineId = undefined;
        throw new Error('provider_unavailable');
      });
    if (!record(result) || !result.ok)
      throw new Error(
        record(result) && typeof result.error === 'string'
          ? result.error
          : 'provider_unavailable',
      );
    if (!validResult(result.value, job)) throw new Error('bad_response');
    return result.value;
  }
  async function ui(message: UiCommand): Promise<unknown> {
    if (message.type === 'GET_PREFERENCES') {
      const prefs = await repo.get();
      return {
        ...prefs,
        access: await Promise.all(
          Object.keys(prefs.perOriginRules).map(async (origin) => ({
            origin,
            granted: await access(origin),
          })),
        ),
      };
    }
    if (
      message.type === 'DISABLE_ORIGIN_RULE' ||
      message.type === 'REMOVE_ORIGIN_RULE'
    ) {
      if (message.type === 'REMOVE_ORIGIN_RULE')
        await repo.remove(message.origin);
      else await repo.setEnabled(message.origin, false);
      await clearManualOverrides(message.origin);
      await reconcile();
      await notify();
      return null;
    }
    if (message.type === 'POPUP_GET_CONTEXT') {
      const tab =
        message.tabId === undefined
          ? (await browser.tabs.query({ active: true, currentWindow: true }))[0]
          : await browser.tabs.get(message.tabId);
      const prefs = await repo.get();
      const origin = siteKey(tab?.url ?? '');
      const rule = origin ? prefs.perOriginRules[origin] : undefined;
      let page: unknown;
      if (tab?.id !== undefined)
        try {
          page = await browser.tabs.sendMessage(
            tab.id,
            { type: 'PAGE_GET_STATUS' },
            { frameId: 0 },
          );
        } catch {
          /* A content script has not been authorized yet. */
        }
      const granted = origin ? await access(origin) : false;
      return {
        tabId: tab?.id,
        origin,
        rule,
        granted,
        defaultTargetLanguage: prefs.defaultTargetLanguage,
        page,
        status: !origin
          ? 'unsupported-page'
          : rule?.enabled && !granted
            ? 'permission-needed'
            : record(page)
              ? page.status
              : rule?.enabled
                ? 'ready'
                : 'disabled',
      };
    }
    if (!('tabId' in message)) throw new Error('invalid_message');
    const { origin } = await getTab(message.tabId);
    if (message.type === 'OPEN_ENGINE') {
      if (import.meta.env.BROWSER === 'firefox')
        throw new Error(
          'provider_unavailable: Firefox provider is planned for Phase 3.',
        );
      const target = message.target ?? (await repo.get()).defaultTargetLanguage;
      const engineUrl =
        browser.runtime.getURL('/engine.html') +
        `?source=${encodeURIComponent(message.source === 'auto' || !message.source ? 'es' : message.source)}&target=${encodeURIComponent(target)}`;
      const existing = await browser.tabs.query({
        url: browser.runtime.getURL('/engine.html') + '*',
      });
      if (existing[0]?.id !== undefined) {
        const previous = new URL(existing[0].url ?? engineUrl);
        const requested = new URL(engineUrl);
        const pairChanged = previous.search !== requested.search;
        if (pairChanged) selectedEngineId = undefined;
        await browser.tabs.update(existing[0].id, {
          active: true,
          ...(pairChanged ? { url: engineUrl } : {}),
        });
        return null;
      }
      await browser.tabs.create({
        url: engineUrl,
      });
      return null;
    }
    if (message.type === 'ENABLE_ORIGIN_RULE') {
      if (!(await access(origin))) throw new Error('missing_host_access');
      await repo.save(origin, message.target, message.source);
      await sessions.clear(message.tabId);
      await reconcile();
      await inject(message.tabId);
      await notify();
      return null;
    }
    if (message.type === 'TRANSLATE_ONCE') {
      // executeScript itself verifies a real activeTab or host grant. No durable rule or permission is created.
      await sessions.set(message.tabId, {
        once: {
          origin,
          config: {
            sourceLanguage: message.source,
            targetLanguage: message.target,
          },
        },
      });
      try {
        await inject(message.tabId);
      } catch (error) {
        await sessions.clear(message.tabId);
        throw error;
      }
      return null;
    }
    if (message.type === 'RESUME_TAB') {
      await sessions.clear(message.tabId);
      await inject(message.tabId);
      return null;
    }
    if (message.type === 'PAUSE_TAB' || message.type === 'REVERT_PAGE') {
      const reply: unknown = await browser.tabs.sendMessage(
        message.tabId,
        { type: 'PAGE_GET_STATUS' },
        { frameId: 0 },
      );
      await sessions.set(message.tabId, {
        pausedDocumentId:
          record(reply) && typeof reply.documentId === 'string'
            ? reply.documentId
            : '*',
      });
      await browser.tabs.sendMessage(
        message.tabId,
        { type: 'STOP_PAGE' },
        { frameId: 0 },
      );
      return null;
    }
  }
  async function handle(
    message: unknown,
    sender: Parameters<
      Parameters<typeof browser.runtime.onMessage.addListener>[0]
    >[1],
  ): Promise<unknown> {
    if (sender.id !== browser.runtime.id || !record(message))
      throw new Error('invalid_message');
    const trustedPage =
      !!sender.url &&
      ['popup.html', 'options.html', 'engine.html'].some(
        (path) =>
          new URL(sender.url!).origin ===
            new URL(browser.runtime.getURL('/')).origin &&
          new URL(sender.url!).pathname === `/${path}`,
      );
    if (message.type === 'ENGINE_READY' && trustedPage) {
      if (
        typeof message.engineId === 'string' &&
        message.engineId.length <= 100
      )
        selectedEngineId = message.engineId;
      await notify();
      return null;
    }
    if (isUiCommand(message) && trustedPage) return ui(message);
    if (sender.tab?.id === undefined || sender.frameId !== 0 || !sender.url)
      throw new Error('invalid_sender');
    if (
      message.type === 'CONTENT_GET_CONFIG' &&
      typeof message.documentId === 'string' &&
      message.documentId.length <= 100
    ) {
      return {
        config: await configFor(sender.tab.id, sender.url, message.documentId),
      };
    }
    if (message.type === 'TRANSLATE_BATCH' && isTranslationJob(message.job)) {
      const job = message.job;
      if (siteKey(sender.url) !== job.originKey)
        throw new Error('origin_mismatch');
      const config = await configFor(sender.tab.id, sender.url, job.documentId);
      if (
        !config ||
        config.targetLanguage !== job.targetLanguage ||
        (config.sourceLanguage !== 'auto' &&
          config.sourceLanguage !== job.sourceLanguage)
      )
        throw new Error('missing_host_access');
      const result = await engine(job);
      const current = await configFor(
        sender.tab.id,
        sender.url,
        job.documentId,
      );
      if (
        !current ||
        current.targetLanguage !== config.targetLanguage ||
        current.sourceLanguage !== config.sourceLanguage
      )
        throw new Error('canceled');
      return result;
    }
    throw new Error('invalid_message');
  }
  browser.runtime.onMessage.addListener((message, sender, respond) => {
    if (
      record(message) &&
      ['ENGINE_TRANSLATE', 'ENGINE_PING'].includes(message.type as string)
    )
      return;
    void handle(message, sender)
      .then((value) => respond({ ok: true, value } satisfies Reply<unknown>))
      .catch((error) => {
        const code = error instanceof Error ? error.message : 'unknown_error';
        const safe =
          /^(unsupported_url|missing_host_access|invalid_message|invalid_sender|origin_mismatch|provider_unavailable|unsupported_pair|model_prepare_required|model_download_failed|provider_timeout|bad_response|canceled|storage_failure|unsupported_schema)/.exec(
            code,
          )?.[0] ?? 'unknown_error';
        respond({ ok: false, error: safe } satisfies Reply<never>);
      });
    return true;
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void sessions.clear(tabId).catch(() => {});
  });
  browser.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status === 'loading') {
      void sessions.clear(tabId).catch(() => {});
    }
  });
  browser.permissions.onAdded.addListener(() => {
    void reconcile()
      .then(() => notify())
      .catch(() => {});
  });
  browser.permissions.onRemoved.addListener(() => {
    void clearManualOverrides()
      .then(() => notify())
      .then(() => reconcile())
      .catch(() => {});
  });
  browser.runtime.onStartup.addListener(() => {
    void reconcile().catch(() => {});
  });
  browser.runtime.onInstalled.addListener(() => {
    void reconcile().catch(() => {});
  });
  void reconcile().catch(() => {});
});
