import { browser } from 'wxt/browser';
import { language } from '../../src/core/domain/site-key';
import { isTranslationJob, record } from '../../src/core/messaging/protocol';
import {
  NativeChromeEngine,
  NativeEngineError,
} from '../../src/core/translate/native-chrome';
import type { EngineState } from '../../src/core/translate/engine';

const engine = new NativeChromeEngine();
const engineId = crypto.randomUUID();
const form = document.querySelector<HTMLFormElement>('#model-form')!;
const source = document.querySelector<HTMLInputElement>('#source')!;
const target = document.querySelector<HTMLInputElement>('#target')!;
const prepare = document.querySelector<HTMLButtonElement>('#prepare')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const download = document.querySelector<HTMLProgressElement>('#download')!;
const query = new URL(location.href).searchParams;
let state: EngineState = 'provider-unavailable';
let revision = 0;

source.value = language(query.get('source')) ? query.get('source')! : 'es';
const defaultTarget = browser.i18n.getUILanguage();
target.value = language(query.get('target'))
  ? query.get('target')!
  : defaultTarget;

function failure(error: unknown): string {
  return error instanceof NativeEngineError
    ? `${error.code}: ${error.message}`
    : 'provider_unavailable: On-device translation is unavailable. Open translation setup to retry.';
}

function setState(next: EngineState, progress?: number): void {
  state = next;
  download.hidden = next !== 'downloading-model';
  if (typeof progress === 'number') download.value = progress;
  const messages: Record<EngineState, string> = {
    ready: `On-device translation is ready for ${source.value} → ${target.value}. Keep this tab open.`,
    'downloading-model':
      typeof progress === 'number'
        ? `Preparing language model: ${Math.round(progress * 100)}%.`
        : 'Preparing language model…',
    'provider-unavailable':
      'This pair is not ready. Click Prepare language model. If this browser does not support on-device translation, the original page stays unchanged.',
    error:
      'The language model could not be prepared. Check connectivity and try again.',
  };
  status.textContent = messages[next];
}

async function inspectPair(): Promise<void> {
  const current = ++revision;
  const available =
    language(source.value) &&
    language(target.value) &&
    (await engine.isAvailable({ source: source.value, target: target.value }));
  if (current === revision)
    setState(available ? 'ready' : 'provider-unavailable');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  revision += 1;
  if (!language(source.value) || !language(target.value)) {
    status.textContent =
      'Choose valid source and target language codes. Automatic source detection cannot prepare a model.';
    return;
  }
  const pair = {
    source: Intl.getCanonicalLocales(source.value)[0]!,
    target: Intl.getCanonicalLocales(target.value)[0]!,
  };
  source.value = pair.source;
  target.value = pair.target;
  prepare.disabled = true;
  source.disabled = true;
  target.disabled = true;
  status.textContent = 'Checking language model…';
  // Invoke directly from the click/submit gesture, before awaiting any other work.
  void engine
    .prepare(pair, setState)
    .then(async () => {
      // Background retries saved rules after explicit model preparation.
      await browser.runtime
        .sendMessage({ type: 'ENGINE_READY', engineId })
        .catch(() => undefined);
    })
    .catch((error: unknown) => {
      status.textContent = failure(error);
    })
    .finally(() => {
      prepare.disabled = false;
      source.disabled = false;
      target.disabled = false;
    });
});

source.addEventListener('change', () => {
  void inspectPair();
});
target.addEventListener('change', () => {
  void inspectPair();
});

browser.runtime.onMessage.addListener((message: unknown, sender) => {
  // Content scripts have sender.tab and cannot use this privileged engine bridge.
  if (sender.id !== browser.runtime.id || sender.tab || !record(message))
    return;
  if (message.type === 'ENGINE_PING')
    return Promise.resolve({ ok: true, value: { state, engineId } });
  if (message.type !== 'ENGINE_TRANSLATE' || message.engineId !== engineId)
    return;
  if (!isTranslationJob(message.job)) {
    return Promise.resolve({
      ok: false,
      error: 'bad_response: Invalid translation batch.',
    });
  }
  return engine.translate(message.job).then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error: failure(error) }),
  );
});

window.addEventListener('pagehide', () => engine.dispose(), { once: true });
void inspectPair();
