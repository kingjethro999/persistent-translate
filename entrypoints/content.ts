import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import {
  ContentController,
  type Config,
} from '../src/core/lifecycle/controller';
import { record } from '../src/core/messaging/protocol';
import { language } from '../src/core/domain/site-key';
import type { TranslationResult } from '../src/core/translate/engine';
export default defineContentScript({
  matches: [],
  registration: 'runtime',
  runAt: 'document_start',
  allFrames: false,
  main(ctx) {
    const guard = globalThis as typeof globalThis & {
      __persistentTranslate?: boolean;
    };
    if (guard.__persistentTranslate) return;
    guard.__persistentTranslate = true;
    const controller = new ContentController(document, async (job) => {
      const reply = await browser.runtime.sendMessage({
        type: 'TRANSLATE_BATCH',
        job,
      });
      if (!record(reply) || !reply.ok)
        throw new Error(
          record(reply) && typeof reply.error === 'string'
            ? reply.error
            : 'provider_unavailable',
        );
      return reply.value as TranslationResult;
    });
    let generation = 0;
    async function refresh() {
      const version = ++generation;
      try {
        const reply = await browser.runtime.sendMessage({
          type: 'CONTENT_GET_CONFIG',
          documentId: controller.documentId,
        });
        if (version !== generation) return;
        if (
          record(reply) &&
          reply.ok &&
          record(reply.value) &&
          record(reply.value.config) &&
          language(reply.value.config.sourceLanguage, true) &&
          language(reply.value.config.targetLanguage)
        )
          controller.configure(reply.value.config as unknown as Config);
        else controller.stop(true);
      } catch {
        if (version === generation) controller.stop(true);
      }
    }
    browser.runtime.onMessage.addListener((message, sender, respond) => {
      if (sender.id !== browser.runtime.id || sender.tab || !record(message))
        return;
      if (message.type === 'PAGE_GET_STATUS') {
        respond({
          ...controller.getState(),
          documentId: controller.documentId,
        });
        return;
      }
      if (message.type === 'REFRESH_CONFIG') {
        void refresh();
        return;
      }
      if (message.type === 'STOP_PAGE') {
        generation++;
        controller.stop(true);
        respond({ ok: true });
      }
    });
    ctx.addEventListener(window, 'pagehide', () => {
      generation++;
      controller.stop(true);
    });
    ctx.addEventListener(window, 'pageshow', () => void refresh());
    ctx.onInvalidated(() => {
      controller.stop(true);
      delete guard.__persistentTranslate;
    });
    void refresh();
  },
});
