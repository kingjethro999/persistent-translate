import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NativeChromeEngine,
  type NativeTranslator,
  type NativeTranslatorFactory,
} from '../../src/core/translate/native-chrome';
import type { TranslationJob } from '../../src/core/translate/engine';

function job(overrides: Partial<TranslationJob> = {}): TranslationJob {
  return {
    requestId: 'request-1',
    documentId: 'document-1',
    documentEpoch: 2,
    routeEpoch: 3,
    originKey: 'https://example.test',
    provider: 'chrome-native',
    sourceLanguage: 'es',
    targetLanguage: 'en',
    segments: [{ id: 'heading', text: 'Hola' }],
    ...overrides,
  };
}

function nativeFixture(availability = 'available') {
  const instances: NativeTranslator[] = [];
  const api: NativeTranslatorFactory = {
    availability: vi.fn(async () => availability),
    create: vi.fn(async (options) => {
      options.monitor?.({
        addEventListener(
          _type: 'downloadprogress',
          listener: (event: { loaded: number }) => void,
        ) {
          listener({ loaded: 0.5 });
        },
      });
      const translator = {
        translate: vi.fn(
          async (text: string) =>
            ({ Hola: 'Hello', Adiós: 'Goodbye' })[text] ?? text,
        ),
        destroy: vi.fn(),
      };
      instances.push(translator);
      return translator;
    }),
  };
  return { api, instances };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('NativeChromeEngine', () => {
  it('reports unsupported browser capability without creating a translator', async () => {
    const engine = new NativeChromeEngine({ api: null });
    expect(await engine.isAvailable({ source: 'es', target: 'en' })).toBe(
      false,
    );
    await expect(engine.translate(job())).rejects.toMatchObject({
      code: 'provider_unavailable',
    });
  });

  it('does not download a model from a passive translation job', async () => {
    const { api } = nativeFixture('downloadable');
    const engine = new NativeChromeEngine({ api });
    await expect(engine.translate(job())).rejects.toMatchObject({
      code: 'model_prepare_required',
    });
    expect(api.create).not.toHaveBeenCalled();
  });

  it('requires a user gesture before preparing a downloadable model', async () => {
    const { api } = nativeFixture('downloadable');
    const engine = new NativeChromeEngine({
      api,
      hasUserActivation: () => false,
    });
    await expect(
      engine.prepare({ source: 'es', target: 'en' }),
    ).rejects.toMatchObject({
      code: 'model_prepare_required',
    });
    expect(api.create).not.toHaveBeenCalled();
  });

  it('reports model download progress after explicit preparation and reuses that translator', async () => {
    const { api } = nativeFixture('downloadable');
    const engine = new NativeChromeEngine({
      api,
      hasUserActivation: () => true,
    });
    const states: { state: string; progress?: number }[] = [];
    await engine.prepare({ source: 'es', target: 'en' }, (state, progress) => {
      states.push({ state, progress });
    });
    expect(states).toContainEqual({
      state: 'downloading-model',
      progress: 0.5,
    });
    expect(states.at(-1)).toEqual({ state: 'ready', progress: 1 });
    expect(await engine.isAvailable({ source: 'es', target: 'en' })).toBe(true);
    expect((await engine.translate(job())).segments).toEqual([
      { id: 'heading', translatedText: 'Hello' },
    ]);
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it('preserves request and epoch identity while translating sequential segments', async () => {
    const { api, instances } = nativeFixture();
    const engine = new NativeChromeEngine({ api });
    expect(
      await engine.translate(
        job({
          segments: [
            { id: 'heading', text: 'Hola' },
            { id: 'footer', text: 'Adiós' },
          ],
        }),
      ),
    ).toEqual({
      requestId: 'request-1',
      documentId: 'document-1',
      documentEpoch: 2,
      routeEpoch: 3,
      segments: [
        { id: 'heading', translatedText: 'Hello' },
        { id: 'footer', translatedText: 'Goodbye' },
      ],
    });
    expect(instances[0]?.translate).toHaveBeenNthCalledWith(
      1,
      'Hola',
      expect.any(Object),
    );
    expect(instances[0]?.translate).toHaveBeenNthCalledWith(
      2,
      'Adiós',
      expect.any(Object),
    );
  });

  it('rejects already canceled work before contacting the native API', async () => {
    const { api } = nativeFixture();
    const engine = new NativeChromeEngine({ api });
    const abort = new AbortController();
    abort.abort();
    await expect(engine.translate(job(), abort.signal)).rejects.toMatchObject({
      code: 'canceled',
    });
    expect(api.availability).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('discards an in-flight result when its signal is canceled', async () => {
    const { api, instances } = nativeFixture();
    const engine = new NativeChromeEngine({ api });
    await engine.prepare({ source: 'es', target: 'en' });
    let finish: ((value: string) => void) | undefined;
    instances[0]!.translate = () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      });
    const abort = new AbortController();
    const result = engine.translate(job(), abort.signal);
    const rejection = expect(result).rejects.toMatchObject({
      code: 'canceled',
    });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    abort.abort();
    finish?.('Hello');
    await rejection;
  });

  it('bounds stalled native translations and does not leak source text into errors', async () => {
    vi.useFakeTimers();
    const { api, instances } = nativeFixture();
    const engine = new NativeChromeEngine({ api, timeoutMs: 20 });
    await engine.prepare({ source: 'es', target: 'en' });
    instances[0]!.translate = () => new Promise<string>(() => {});
    const rejected = expect(engine.translate(job())).rejects.toMatchObject({
      code: 'provider_timeout',
    });
    await vi.advanceTimersByTimeAsync(25);
    await rejected;
    expect(instances[0]!.destroy).toHaveBeenCalledOnce();
  });

  it('rejects empty native output rather than erasing the page', async () => {
    const { api, instances } = nativeFixture();
    const engine = new NativeChromeEngine({ api });
    await engine.prepare({ source: 'es', target: 'en' });
    instances[0]!.translate = async () => '';
    await expect(engine.translate(job())).rejects.toMatchObject({
      code: 'bad_response',
    });
  });

  it('rejects oversized native output before returning it to the page', async () => {
    const { api, instances } = nativeFixture();
    const engine = new NativeChromeEngine({ api });
    await engine.prepare({ source: 'es', target: 'en' });
    instances[0]!.translate = async () => 'x'.repeat(20_001);
    await expect(engine.translate(job())).rejects.toMatchObject({
      code: 'bad_response',
    });
  });

  it('returns same-language content without allocating model resources', async () => {
    const { api } = nativeFixture();
    const engine = new NativeChromeEngine({ api });
    const result = await engine.translate(job({ targetLanguage: 'es' }));
    expect(result.segments).toEqual([
      { id: 'heading', translatedText: 'Hola' },
    ]);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('rejects unknown automatic source language instead of guessing a native pair', async () => {
    const { api } = nativeFixture();
    const engine = new NativeChromeEngine({ api });
    await expect(
      engine.translate(job({ sourceLanguage: 'auto' })),
    ).rejects.toMatchObject({
      code: 'unsupported_pair',
    });
    expect(api.availability).not.toHaveBeenCalled();
  });

  it('rejects unsupported language pairs without attempting creation', async () => {
    const { api } = nativeFixture('unavailable');
    const engine = new NativeChromeEngine({
      api,
      hasUserActivation: () => true,
    });
    await expect(
      engine.prepare({ source: 'es', target: 'en' }),
    ).rejects.toMatchObject({
      code: 'unsupported_pair',
    });
    expect(api.create).not.toHaveBeenCalled();
  });

  it('rejects oversized batches before contacting the model', async () => {
    const { api } = nativeFixture();
    const engine = new NativeChromeEngine({ api });
    await expect(
      engine.translate(
        job({ segments: [{ id: 'huge', text: 'x'.repeat(30_001) }] }),
      ),
    ).rejects.toMatchObject({ code: 'bad_response' });
    expect(api.create).not.toHaveBeenCalled();
  });

  it('destroys the oldest unused language pair when the resource limit is reached', async () => {
    const { api, instances } = nativeFixture();
    const engine = new NativeChromeEngine({ api, maxPairs: 2 });
    await engine.prepare({ source: 'es', target: 'en' });
    await engine.prepare({ source: 'fr', target: 'en' });
    await engine.prepare({ source: 'de', target: 'en' });
    expect(instances[0]!.destroy).toHaveBeenCalledOnce();
    expect(instances[1]!.destroy).not.toHaveBeenCalled();
    engine.dispose();
    expect(instances[1]!.destroy).toHaveBeenCalledOnce();
    expect(instances[2]!.destroy).toHaveBeenCalledOnce();
    await expect(engine.translate(job())).rejects.toMatchObject({
      code: 'provider_unavailable',
    });
  });

  it('does not reflect native exception details into user-visible failures', async () => {
    const { api } = nativeFixture();
    api.create = async () => {
      throw new Error('raw secret page text');
    };
    const engine = new NativeChromeEngine({ api });
    await expect(
      engine.prepare({ source: 'es', target: 'en' }),
    ).rejects.toMatchObject({
      code: 'model_download_failed',
    });
    await expect(
      engine.prepare({ source: 'es', target: 'en' }),
    ).rejects.not.toThrow('raw secret');
  });

  it('shares a pending translator creation for concurrent requests for the same pair', async () => {
    const { api, instances } = nativeFixture();
    const engine = new NativeChromeEngine({ api });
    await Promise.all([
      engine.prepare({ source: 'es', target: 'en' }),
      engine.prepare({ source: 'es', target: 'en' }),
    ]);
    expect(instances).toHaveLength(1);
    expect((await engine.translate(job())).segments[0]?.translatedText).toBe(
      'Hello',
    );
  });

  it('releases a translator only once when the engine closes during translation', async () => {
    const { api, instances } = nativeFixture();
    const engine = new NativeChromeEngine({ api });
    await engine.prepare({ source: 'es', target: 'en' });
    let started = false;
    instances[0]!.translate = () => {
      started = true;
      return new Promise<string>(() => {});
    };
    const result = engine.translate(job());
    const rejection = expect(result).rejects.toMatchObject({
      code: 'canceled',
    });
    await vi.waitFor(() => expect(started).toBe(true));
    engine.dispose();
    await rejection;
    expect(instances[0]!.destroy).toHaveBeenCalledOnce();
  });
});

describe('engine document message routing', () => {
  it('routes each translation only to the instance selected by its engine identifier', async () => {
    type Sender = { id?: string; tab?: { id: number } };
    type Listener = (message: unknown, sender: Sender) => unknown;
    let listener: Listener | undefined;
    const sendMessage = vi.fn(async () => ({ ok: true }));
    const { api } = nativeFixture();
    vi.stubGlobal('Translator', api);
    document.body.innerHTML =
      '<form id="model-form"><input id="source"><input id="target"><button id="prepare" type="submit">Prepare</button></form><p id="status"></p><progress id="download"></progress>';
    vi.doMock('wxt/browser', () => ({
      browser: {
        i18n: { getUILanguage: () => 'en' },
        runtime: {
          id: 'unit-extension',
          sendMessage,
          onMessage: {
            addListener: (callback: Listener) => {
              listener = callback;
            },
          },
        },
      },
    }));
    await import('../../entrypoints/engine/main');
    const sender = { id: 'unit-extension' };
    const ping = (await listener?.({ type: 'ENGINE_PING' }, sender)) as {
      ok: boolean;
      value: { engineId: string };
    };
    expect(ping.value.engineId).toEqual(expect.any(String));
    expect(
      await listener?.(
        {
          type: 'ENGINE_TRANSLATE',
          engineId: 'different-instance',
          job: job(),
        },
        sender,
      ),
    ).toBeUndefined();
    const result = await listener?.(
      { type: 'ENGINE_TRANSLATE', engineId: ping.value.engineId, job: job() },
      sender,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { segments: [{ id: 'heading', translatedText: 'Hello' }] },
    });
    expect(
      await listener?.(
        { type: 'ENGINE_TRANSLATE', engineId: ping.value.engineId, job: job() },
        { ...sender, tab: { id: 4 } },
      ),
    ).toBeUndefined();
    document
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'ENGINE_READY',
        engineId: ping.value.engineId,
      }),
    );
    window.dispatchEvent(new Event('pagehide'));
    vi.doUnmock('wxt/browser');
  });
});
