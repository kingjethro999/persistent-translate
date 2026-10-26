import { language, siteKey } from '../domain/site-key';
import type { TranslationJob, TranslationResult } from '../translate/engine';
export type Reply<T> = { ok: true; value: T } | { ok: false; error: string };
export function record(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const id = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 100;
const epoch = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
export function isTranslationJob(v: unknown): v is TranslationJob {
  if (
    !record(v) ||
    !id(v.requestId) ||
    !id(v.documentId) ||
    !epoch(v.documentEpoch) ||
    !epoch(v.routeEpoch) ||
    typeof v.originKey !== 'string' ||
    siteKey(v.originKey) !== v.originKey ||
    v.provider !== 'chrome-native' ||
    !language(v.sourceLanguage) ||
    !language(v.targetLanguage) ||
    !Array.isArray(v.segments) ||
    v.segments.length === 0 ||
    v.segments.length > 32
  )
    return false;
  let size = 0;
  const ids = new Set<string>();
  return v.segments.every((s) => {
    if (
      !record(s) ||
      !id(s.id) ||
      typeof s.text !== 'string' ||
      !s.text.trim() ||
      s.text.length > 5000 ||
      ids.has(s.id)
    )
      return false;
    size += s.text.length;
    ids.add(s.id);
    return size <= 12000;
  });
}
export function validResult(
  v: unknown,
  job: TranslationJob,
): v is TranslationResult {
  if (
    !record(v) ||
    v.requestId !== job.requestId ||
    v.documentId !== job.documentId ||
    v.documentEpoch !== job.documentEpoch ||
    v.routeEpoch !== job.routeEpoch ||
    !Array.isArray(v.segments) ||
    v.segments.length !== job.segments.length
  )
    return false;
  return v.segments.every(
    (s, i) =>
      record(s) &&
      s.id === job.segments[i]?.id &&
      typeof s.translatedText === 'string' &&
      s.translatedText.length <= 10000,
  );
}
export type UiCommand =
  | { type: 'POPUP_GET_CONTEXT'; tabId?: number }
  | { type: 'GET_PREFERENCES' }
  | {
      type: 'ENABLE_ORIGIN_RULE' | 'TRANSLATE_ONCE';
      tabId: number;
      source: string;
      target: string;
    }
  | {
      type: 'PAUSE_TAB' | 'RESUME_TAB' | 'REVERT_PAGE' | 'OPEN_ENGINE';
      tabId: number;
      source?: string;
      target?: string;
    }
  | { type: 'DISABLE_ORIGIN_RULE' | 'REMOVE_ORIGIN_RULE'; origin: string };
export function isUiCommand(v: unknown): v is UiCommand {
  if (!record(v)) return false;
  if (v.type === 'GET_PREFERENCES') return true;
  if (v.type === 'POPUP_GET_CONTEXT')
    return (
      v.tabId === undefined ||
      (Number.isSafeInteger(v.tabId) && (v.tabId as number) >= 0)
    );
  if (v.type === 'DISABLE_ORIGIN_RULE' || v.type === 'REMOVE_ORIGIN_RULE')
    return typeof v.origin === 'string' && siteKey(v.origin) === v.origin;
  if (!Number.isSafeInteger(v.tabId) || (v.tabId as number) < 0) return false;
  if (v.type === 'ENABLE_ORIGIN_RULE' || v.type === 'TRANSLATE_ONCE')
    return language(v.source, true) && language(v.target);
  return (
    ['PAUSE_TAB', 'RESUME_TAB', 'REVERT_PAGE', 'OPEN_ENGINE'].includes(
      v.type as string,
    ) &&
    (v.source === undefined || language(v.source, true)) &&
    (v.target === undefined || language(v.target))
  );
}
