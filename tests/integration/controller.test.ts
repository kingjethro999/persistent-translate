import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { ContentController } from '../../src/core/lifecycle/controller';
import type {
  TranslationJob,
  TranslationResult,
} from '../../src/core/translate/engine';
const config = { sourceLanguage: 'es', targetLanguage: 'en' };
const controllers: ContentController[] = [];
afterEach(() => {
  for (const controller of controllers) controller.stop(true);
  controllers.length = 0;
});
const translated = (job: TranslationJob): TranslationResult => ({
  ...job,
  segments: job.segments.map((s) => ({
    id: s.id,
    translatedText: s.text === 'Hola' ? 'Hello' : 'Login',
  })),
});
beforeEach(() => {
  document.documentElement.lang = 'es';
  document.body.innerHTML = '<h1>Hola</h1><input value="secreto">';
});
it('bootstraps safely before the parser has created the document root', async () => {
  const root = document.documentElement;
  const controller = new ContentController(document, async (job) =>
    translated(job),
  );
  controllers.push(controller);
  root.remove();
  try {
    expect(() => controller.configure(config)).not.toThrow();
  } finally {
    document.append(root);
  }
  await vi.waitFor(
    () => expect(document.querySelector('h1')!.textContent).toBe('Hello'),
    { timeout: 10000 },
  );
});
it('translates initial and added DOM without looping on its own output', async () => {
  let calls = 0;
  const controller = new ContentController(document, async (job) => {
    calls++;
    return translated(job);
  });
  controllers.push(controller);
  controller.configure(config);
  await vi.waitFor(
    () => expect(document.querySelector('h1')!.textContent).toBe('Hello'),
    { timeout: 10_000 },
  );
  const p = document.createElement('p');
  p.textContent = 'Entrar';
  document.body.append(p);
  await vi.waitFor(() => expect(p.textContent).toBe('Login'));
  expect(calls).toBe(2);
  expect(document.querySelector('input')!.value).toBe('secreto');
  controller.stop(true);
  expect(document.querySelector('h1')!.textContent).toBe('Hola');
});
it('discards late results after pause and preserves newer site text', async () => {
  let finish!: (r: TranslationResult) => void;
  let request!: TranslationJob;
  const controller = new ContentController(document, (job) => {
    request = job;
    return new Promise((r) => {
      finish = r;
    });
  });
  controller.configure(config);
  await vi.waitFor(() => expect(request).toBeDefined());
  controller.stop(true);
  document.querySelector('h1')!.textContent = 'Nuevo';
  finish(translated(request));
  await new Promise((r) => setTimeout(r, 30));
  expect(document.querySelector('h1')!.textContent).toBe('Nuevo');
});
it('does not patch after permission-sensitive eligibility changes in flight', async () => {
  let finish!: (r: TranslationResult) => void;
  let request!: TranslationJob;
  const controller = new ContentController(document, (job) => {
    request = job;
    return new Promise((r) => {
      finish = r;
    });
  });
  controller.configure(config);
  await vi.waitFor(() => expect(request).toBeDefined());
  document.querySelector('h1')!.setAttribute('translate', 'no');
  finish(translated(request));
  await new Promise((r) => setTimeout(r, 30));
  expect(document.querySelector('h1')!.textContent).toBe('Hola');
  controller.stop(true);
});
