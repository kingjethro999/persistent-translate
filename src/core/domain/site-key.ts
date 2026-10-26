const restricted = new Set([
  'chromewebstore.google.com',
  'addons.mozilla.org',
  'microsoftedge.microsoft.com',
]);
export function siteKey(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      restricted.has(url.hostname) ||
      url.username ||
      url.password
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

// The rule still checks the exact origin (including port) at runtime. Browser
// match-pattern grants may cover additional ports on this single host.
export function hostPattern(origin: string): string {
  if (!siteKey(origin)) throw new Error('unsupported_url');
  const url = new URL(origin);
  return `${url.protocol}//${url.hostname}/*`;
}
export function language(value: unknown, allowAuto = false): value is string {
  if (allowAuto && value === 'auto') return true;
  if (typeof value !== 'string' || value.length > 35 || value === 'auto')
    return false;
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}
