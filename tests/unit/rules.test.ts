// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { siteKey, hostPattern } from '../../src/core/domain/site-key';
import {
  migratePreferences,
  RuleRepository,
  resolveRule,
  type StoragePort,
} from '../../src/core/rules/repository';

describe('exact origin persistence', () => {
  it('covers /login but isolates scheme, subdomains, and ports', () => {
    expect(siteKey('https://EXAMPLE.test/a?q=secret#x')).toBe(
      'https://example.test',
    );
    expect(siteKey('https://example.test/login')).toBe(
      siteKey('https://example.test/'),
    );
    expect(
      new Set(
        [
          'https://example.test',
          'http://example.test',
          'https://app.example.test',
          'https://example.test:444',
        ].map(siteKey),
      ).size,
    ).toBe(4);
    expect(hostPattern('https://example.test:444')).toBe(
      'https://example.test/*',
    );
    expect(siteKey('https://example.co.uk/login')).toBe(
      'https://example.co.uk',
    );
  });
  it.each([
    'chrome://settings',
    'about:blank',
    'file:///tmp/a',
    'https://chromewebstore.google.com/detail/x',
    'https://addons.mozilla.org/en-US/firefox/',
  ])('rejects restricted %s', (url) => expect(siteKey(url)).toBeNull());
  it('migrates only forward without losing user intent', () => {
    expect(migratePreferences(undefined, 'fr').defaultTargetLanguage).toBe(
      'fr',
    );
    expect(() => migratePreferences({ schemaVersion: 99 }, 'en')).toThrow(
      'unsupported_schema',
    );
    expect(() =>
      migratePreferences({ schemaVersion: 1, perOriginRules: { x: {} } }, 'en'),
    ).toThrow();
  });
  it('persists independent rules across repository restart and serializes competing writes', async () => {
    let stored: unknown;
    const storage: StoragePort = {
      read: async () => structuredClone(stored),
      write: async (value) => {
        stored = structuredClone(value);
      },
    };
    const repo = new RuleRepository(storage, 'en');
    await Promise.all([
      repo.save('https://example.test/', 'en', 'es'),
      repo.save('https://app.example.test/', 'fr', 'es'),
    ]);
    const restarted = new RuleRepository(storage, 'en');
    expect(
      (await restarted.get()).perOriginRules['https://example.test']
        ?.targetLanguage,
    ).toBe('en');
    expect(Object.keys((await restarted.get()).perOriginRules)).toHaveLength(2);
    await restarted.setEnabled('https://example.test', false);
    expect(
      (await restarted.get()).perOriginRules['https://app.example.test']
        ?.enabled,
    ).toBe(true);
  });
  it('resolves unsupported, missing permission, pause and disabled in order', () => {
    const prefs = migratePreferences(undefined, 'en');
    const base = {
      url: 'https://example.test',
      hasPermission: false,
      paused: true,
      preferences: prefs,
    };
    expect(resolveRule({ ...base, url: 'about:blank' }).status).toBe(
      'unsupported-page',
    );
    expect(resolveRule(base).status).toBe('permission-needed');
    expect(resolveRule({ ...base, hasPermission: true }).status).toBe('paused');
    expect(
      resolveRule({ ...base, hasPermission: true, paused: false }).status,
    ).toBe('disabled');
  });
});
