import { browser } from 'wxt/browser';
import { hostPattern, language } from '../../src/core/domain/site-key';
import { record } from '../../src/core/messaging/protocol';
import '../../src/ui.css';
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const source = element<HTMLSelectElement>('source'),
  target = element<HTMLInputElement>('target');
let tabId: number | undefined,
  origin: string | null = null,
  busy = false;
const labels: Record<string, string> = {
  'unsupported-page': 'This page is restricted. Open a regular website.',
  'permission-needed':
    'Site access was removed. Click Always to grant it again.',
  disabled: 'Choose a language and translate this website.',
  ready: 'Site preference is saved.',
  detecting: 'Page language is uncertain. Choose its language above.',
  translating: 'Translating eligible text…',
  translated: 'Eligible text translated. New content will be checked.',
  'partially-translated':
    'Partially translated. Some content exceeds the current limits.',
  paused: 'Translation paused in this tab. Saved site choice remains.',
  'provider-unavailable':
    'Translation engine unavailable. Open setup below and prepare the language pair.',
  error:
    'Translation stopped. Open setup to check the language model, then retry.',
};
async function send(message: object) {
  const result: unknown = await browser.runtime.sendMessage(message);
  if (!record(result) || !result.ok)
    throw new Error(
      record(result) && typeof result.error === 'string'
        ? result.error
        : 'unknown_error',
    );
  return result.value;
}
function status(text: string) {
  element('status').textContent = text;
}
async function refresh(initial = false) {
  const value = await send({
    type: 'POPUP_GET_CONTEXT',
    ...(tabId === undefined ? {} : { tabId }),
  });
  if (!record(value)) throw new Error('bad_response');
  tabId = typeof value.tabId === 'number' ? value.tabId : undefined;
  origin = typeof value.origin === 'string' ? value.origin : null;
  element('origin').textContent = origin ?? 'Restricted page';
  if (initial) {
    target.value =
      record(value.rule) && typeof value.rule.targetLanguage === 'string'
        ? value.rule.targetLanguage
        : String(value.defaultTargetLanguage ?? 'en');
    source.value =
      record(value.rule) && typeof value.rule.sourceLanguage === 'string'
        ? value.rule.sourceLanguage
        : 'auto';
  }
  if (!busy) status(labels[String(value.status)] ?? 'Ready to translate.');
  for (const id of ['always', 'once', 'pause', 'resume', 'engine'])
    element<HTMLButtonElement>(id).disabled = !origin || busy;
}
async function action(type: string) {
  if (tabId === undefined) return;
  if (!language(target.value) || !language(source.value, true)) {
    status('Enter a valid language code, such as en.');
    return;
  }
  busy = true;
  try {
    await send({ type, tabId, source: source.value, target: target.value });
    busy = false;
    await refresh();
  } catch (error) {
    busy = false;
    status(
      error instanceof Error && error.message === 'missing_host_access'
        ? 'Site access was not granted. Your choice was not saved.'
        : 'Unable to start. Check site access and on-device setup.',
    );
  }
}
element('always').onclick = () => {
  if (!origin || !language(target.value) || !language(source.value, true)) {
    status('Choose valid source and target languages.');
    return;
  }
  // Request synchronously from the click to preserve the browser gesture.
  void browser.permissions
    .request({ origins: [hostPattern(origin)] })
    .then((granted) => {
      if (granted) return action('ENABLE_ORIGIN_RULE');
      status('Site access was declined. Your choice was not saved.');
    })
    .catch(() => status('Unable to request site access.'));
};
for (const [id, type] of [
  ['once', 'TRANSLATE_ONCE'],
  ['pause', 'PAUSE_TAB'],
  ['resume', 'RESUME_TAB'],
  ['engine', 'OPEN_ENGINE'],
])
  element(id!).onclick = () => void action(type!);
element('options').onclick = () => void browser.runtime.openOptionsPage();
void refresh(true).catch(() =>
  status('Unable to read extension state. Close and reopen this popup.'),
);
const interval = setInterval(() => void refresh().catch(() => {}), 1000);
window.addEventListener('pagehide', () => clearInterval(interval), {
  once: true,
});
