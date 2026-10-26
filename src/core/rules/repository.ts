import { language, siteKey } from '../domain/site-key';
export interface OriginRule {
  id: string;
  key: string;
  sourceLanguage: string;
  targetLanguage: string;
  enabled: boolean;
  scope: 'origin';
  providerPreference: 'local-first';
  updatedAt: number;
  schemaVersion: 1;
}
export interface Preferences {
  schemaVersion: 1;
  defaultTargetLanguage: string;
  perOriginRules: Record<string, OriginRule>;
  excludedOrigins: string[];
  allowTextCache: false;
}
export interface StoragePort {
  read(): Promise<unknown>;
  write(value: Preferences): Promise<void>;
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function migratePreferences(raw: unknown, locale: string): Preferences {
  const base: Preferences = {
    schemaVersion: 1,
    defaultTargetLanguage: language(locale)
      ? Intl.getCanonicalLocales(locale)[0]!
      : 'en',
    perOriginRules: {},
    excludedOrigins: [],
    allowTextCache: false,
  };
  if (raw === undefined || raw === null) return base;
  if (!object(raw) || ![0, 1].includes(raw.schemaVersion as number))
    throw new Error('unsupported_schema');
  // v0 was the development schema: same rule fields, no per-rule version.
  if (!object(raw.perOriginRules) || !language(raw.defaultTargetLanguage))
    throw new Error('storage_failure');
  const entries = Object.entries(raw.perOriginRules);
  if (entries.length > 500) throw new Error('storage_failure');
  for (const [key, value] of entries) {
    if (
      !object(value) ||
      siteKey(key) !== key ||
      value.key !== key ||
      !language(value.sourceLanguage, true) ||
      !language(value.targetLanguage) ||
      typeof value.enabled !== 'boolean' ||
      value.scope !== 'origin' ||
      value.providerPreference !== 'local-first' ||
      typeof value.id !== 'string' ||
      !Number.isFinite(value.updatedAt)
    )
      throw new Error('storage_failure');
    if (raw.schemaVersion === 1 && value.schemaVersion !== 1)
      throw new Error('unsupported_schema');
    base.perOriginRules[key] = {
      id: value.id,
      key,
      sourceLanguage: value.sourceLanguage,
      targetLanguage: value.targetLanguage,
      enabled: value.enabled,
      scope: 'origin',
      providerPreference: 'local-first',
      updatedAt: value.updatedAt as number,
      schemaVersion: 1,
    };
  }
  if (
    raw.excludedOrigins !== undefined &&
    (!Array.isArray(raw.excludedOrigins) ||
      raw.excludedOrigins.some(
        (x) => typeof x !== 'string' || siteKey(x) !== x,
      ))
  )
    throw new Error('storage_failure');
  base.excludedOrigins = (raw.excludedOrigins as string[] | undefined) ?? [];
  base.defaultTargetLanguage = raw.defaultTargetLanguage;
  return base;
}
export class RuleRepository {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(
    private storage: StoragePort,
    private locale: string,
  ) {}
  async get(): Promise<Preferences> {
    return migratePreferences(await this.storage.read(), this.locale);
  }
  private update(change: (prefs: Preferences) => void): Promise<void> {
    const next = this.pending
      .catch(() => {})
      .then(async () => {
        const prefs = await this.get();
        change(prefs);
        await this.storage.write(prefs);
      });
    this.pending = next;
    return next;
  }
  save(url: string, target: string, source: string): Promise<void> {
    const key = siteKey(url);
    if (!key || !language(target) || !language(source, true))
      return Promise.reject(new Error('invalid_rule'));
    return this.update((prefs) => {
      if (
        !prefs.perOriginRules[key] &&
        Object.keys(prefs.perOriginRules).length >= 500
      )
        throw new Error('rule_limit');
      prefs.perOriginRules[key] = {
        id: key,
        key,
        targetLanguage: Intl.getCanonicalLocales(target)[0]!,
        sourceLanguage:
          source === 'auto' ? source : Intl.getCanonicalLocales(source)[0]!,
        enabled: true,
        scope: 'origin',
        providerPreference: 'local-first',
        updatedAt: Date.now(),
        schemaVersion: 1,
      };
      prefs.defaultTargetLanguage = target;
      prefs.excludedOrigins = prefs.excludedOrigins.filter((x) => x !== key);
    });
  }
  setEnabled(key: string, enabled: boolean): Promise<void> {
    return this.update((p) => {
      const rule = p.perOriginRules[key];
      if (rule) {
        rule.enabled = enabled;
        rule.updatedAt = Date.now();
      }
    });
  }
  remove(key: string): Promise<void> {
    return this.update((p) => {
      delete p.perOriginRules[key];
    });
  }
}
export function resolveRule(input: {
  url: string;
  hasPermission: boolean;
  paused: boolean;
  preferences: Preferences;
}): { status: string; rule?: OriginRule } {
  const key = siteKey(input.url);
  if (!key) return { status: 'unsupported-page' };
  if (!input.hasPermission) return { status: 'permission-needed' };
  if (input.paused) return { status: 'paused' };
  if (input.preferences.excludedOrigins.includes(key))
    return { status: 'disabled' };
  const rule = input.preferences.perOriginRules[key];
  return rule?.enabled ? { status: 'ready', rule } : { status: 'disabled' };
}
