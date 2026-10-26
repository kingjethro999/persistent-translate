// @vitest-environment node
import { it, expect } from 'vitest';
import {
  TabSessions,
  type SessionStore,
  type TabSession,
} from '../../src/core/rules/tab-session';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

it('reads the latest pause after an earlier delayed write', async () => {
  const started = deferred();
  const release = deferred();
  const data: Record<string, unknown> = {};
  const sessions = new TabSessions({
    get: async (key) => ({ [key]: structuredClone(data[key]) }),
    set: async (values) => {
      started.resolve();
      await release.promise;
      Object.assign(data, structuredClone(values));
    },
    remove: async (key) => {
      delete data[key];
    },
  });
  const write = sessions.set(1, { pausedDocumentId: 'doc' });
  await started.promise;
  const read = sessions.get(1);
  release.resolve();
  await write;
  expect(await read).toEqual({ pausedDocumentId: 'doc' });
});
it('retains page-only and pause intent across worker reconstruction and resets on navigation', async () => {
  const data: Record<string, unknown> = {};
  const storage: SessionStore = {
    get: async (key) => ({ [key]: structuredClone(data[key]) }),
    set: async (values) => {
      Object.assign(data, structuredClone(values));
    },
    remove: async (key) => {
      delete data[key];
    },
  };
  const first = new TabSessions(storage);
  await first.set(1, {
    once: {
      origin: 'https://example.test',
      documentId: 'doc',
      config: { sourceLanguage: 'es', targetLanguage: 'en' },
    },
  });
  await first.set(2, { pausedDocumentId: 'other' });
  const restarted = new TabSessions(storage);
  expect((await restarted.get(1)).once?.config.targetLanguage).toBe('en');
  expect((await restarted.get(2)).pausedDocumentId).toBe('other');
  await restarted.clear(1);
  expect((await restarted.get(1)).once).toBeUndefined();
  expect((await restarted.get(2)).pausedDocumentId).toBe('other');
});
it('rejects malformed session payloads rather than broadening access', async () => {
  const session = new TabSessions({
    get: async (key) => ({
      [key]: {
        once: {
          origin: 'https://example.test/path',
          config: { sourceLanguage: 'es', targetLanguage: 'en' },
        },
      },
    }),
    set: async () => {},
    remove: async () => {},
  });
  expect(await session.get(1)).toEqual({});
});

const once: TabSession = {
  once: {
    origin: 'https://example.test',
    config: { sourceLanguage: 'es', targetLanguage: 'en' },
  },
};

it.each(['pause', 'clear'] as const)(
  'does not let delayed document binding undo a later %s',
  async (action) => {
    const data: Record<string, unknown> = {};
    const started = deferred();
    const release = deferred();
    let delay = true;
    const sessions = new TabSessions({
      get: async (key) => {
        const snapshot = structuredClone(data[key]);
        if (delay) {
          delay = false;
          started.resolve();
          await release.promise;
        }
        return { [key]: snapshot };
      },
      set: async (values) => {
        Object.assign(data, structuredClone(values));
      },
      remove: async (key) => {
        delete data[key];
      },
    });
    await sessions.set(1, once);
    const binding = sessions.forDocument(1, 'https://example.test', 'doc');
    await started.promise;
    const newer =
      action === 'pause'
        ? sessions.set(1, { pausedDocumentId: 'doc' })
        : sessions.clear(1);
    release.resolve();
    await Promise.all([binding, newer]);
    expect(await sessions.get(1)).toEqual(
      action === 'pause' ? { pausedDocumentId: 'doc' } : {},
    );
  },
);

it('binds an origin-matched page-only session once without rebinding or repeat writes', async () => {
  const data: Record<string, unknown> = {};
  let writes = 0;
  const sessions = new TabSessions({
    get: async (key) => ({ [key]: structuredClone(data[key]) }),
    set: async (values) => {
      writes++;
      Object.assign(data, structuredClone(values));
    },
    remove: async (key) => {
      delete data[key];
    },
  });
  await sessions.set(1, once);
  expect(
    (await sessions.forDocument(1, 'https://other.test', 'wrong')).once
      ?.documentId,
  ).toBeUndefined();
  expect(
    (await sessions.forDocument(1, 'https://example.test', 'doc')).once
      ?.documentId,
  ).toBe('doc');
  expect(
    (await sessions.forDocument(1, 'https://example.test', 'doc')).once
      ?.documentId,
  ).toBe('doc');
  expect(
    (await sessions.forDocument(1, 'https://example.test', 'other-doc')).once
      ?.documentId,
  ).toBe('doc');
  expect(writes).toBe(2);
});

it('clears only the matching page-only override and preserves pauses and other tabs', async () => {
  const data: Record<string, unknown> = {};
  const sessions = new TabSessions({
    get: async (key) => ({ [key]: structuredClone(data[key]) }),
    set: async (values) => {
      Object.assign(data, structuredClone(values));
    },
    remove: async (key) => {
      delete data[key];
    },
  });
  await sessions.set(1, { ...once, pausedDocumentId: 'doc' });
  await sessions.set(2, { pausedDocumentId: 'other' });
  await sessions.clearOnce(1, 'https://other.test');
  expect((await sessions.get(1)).once?.origin).toBe('https://example.test');
  await sessions.clearOnce(1, 'https://example.test');
  expect(await sessions.get(1)).toEqual({ pausedDocumentId: 'doc' });
  expect(await sessions.get(2)).toEqual({ pausedDocumentId: 'other' });
  await sessions.set(1, once);
  await sessions.clearOnce(1);
  expect(await sessions.get(1)).toEqual({});
});

it('continues later mutations after a failed write', async () => {
  const data: Record<string, unknown> = {};
  let fail = true;
  const sessions = new TabSessions({
    get: async (key) => ({ [key]: structuredClone(data[key]) }),
    set: async (values) => {
      if (fail) {
        fail = false;
        throw new Error('storage_failure');
      }
      Object.assign(data, structuredClone(values));
    },
    remove: async (key) => {
      delete data[key];
    },
  });
  await expect(sessions.set(1, once)).rejects.toThrow('storage_failure');
  await sessions.set(1, { pausedDocumentId: 'doc' });
  expect(await sessions.get(1)).toEqual({ pausedDocumentId: 'doc' });
});
