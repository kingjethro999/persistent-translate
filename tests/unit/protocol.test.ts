// @vitest-environment node
import { it, expect } from 'vitest';
import {
  isTranslationJob,
  validResult,
  isUiCommand,
} from '../../src/core/messaging/protocol';
import type { TranslationJob } from '../../src/core/translate/engine';
export const job: TranslationJob = {
  requestId: 'r',
  documentId: 'd',
  documentEpoch: 1,
  routeEpoch: 0,
  originKey: 'https://example.test',
  provider: 'chrome-native',
  sourceLanguage: 'es',
  targetLanguage: 'en',
  segments: [{ id: 'a', text: 'Hola' }],
};
it('rejects invalid origins, oversized batches and unknown commands', () => {
  expect(isTranslationJob(job)).toBe(true);
  expect(
    isTranslationJob({ ...job, originKey: 'https://example.test/path' }),
  ).toBe(false);
  expect(
    isTranslationJob({
      ...job,
      segments: [{ id: 'a', text: 'x'.repeat(5001) }],
    }),
  ).toBe(false);
  expect(
    isTranslationJob({ ...job, segments: [...job.segments, ...job.segments] }),
  ).toBe(false);
  expect(
    isUiCommand({
      type: 'ENABLE_ORIGIN_RULE',
      tabId: 1,
      target: 'en',
      source: 'es',
    }),
  ).toBe(true);
  expect(
    isUiCommand({ type: 'ENABLE_ORIGIN_RULE', tabId: -1, target: '<script>' }),
  ).toBe(false);
  expect(isUiCommand({ type: 'RANDOM' })).toBe(false);
});
it('rejects stale or missing/extra provider segments', () => {
  const result = { ...job, segments: [{ id: 'a', translatedText: 'Hello' }] };
  expect(validResult(result, job)).toBe(true);
  expect(validResult({ ...result, routeEpoch: 8 }, job)).toBe(false);
  expect(validResult({ ...result, segments: [] }, job)).toBe(false);
  expect(
    validResult(
      { ...result, segments: [{ id: 'b', translatedText: 'Hello' }] },
      job,
    ),
  ).toBe(false);
});
