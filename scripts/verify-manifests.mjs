import { readFile, writeFile } from 'node:fs/promises';
import { assert, localPath, walkFiles } from './package-utils.mjs';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const expectedPermissions = ['activeTab', 'scripting', 'storage'];
const expectedOptionalHosts = ['http://*/*', 'https://*/*'];
const inventory = {};

for (const browser of ['chrome', 'firefox']) {
  const directory = `.output/${browser}-mv3`;
  const manifest = JSON.parse(
    await readFile(`${directory}/manifest.json`, 'utf8'),
  );
  const fail = (message) => `${browser}: ${message}`;
  assert(manifest.manifest_version === 3, fail('Manifest V3 required'));
  assert(
    manifest.version === packageJson.version,
    fail('manifest/package version mismatch'),
  );
  assert(
    JSON.stringify([...(manifest.permissions ?? [])].sort()) ===
      JSON.stringify(expectedPermissions),
    fail('required permission inventory changed'),
  );
  assert(
    !manifest.host_permissions?.length,
    fail('required host access is forbidden'),
  );
  assert(
    !manifest.content_scripts?.length,
    fail('static host content scripts are forbidden'),
  );
  assert(
    !manifest.optional_permissions?.length,
    fail('unexpected optional API permissions'),
  );
  assert(
    JSON.stringify([...(manifest.optional_host_permissions ?? [])].sort()) ===
      JSON.stringify(expectedOptionalHosts),
    fail('optional host inventory changed'),
  );
  assert(
    !manifest.web_accessible_resources?.length,
    fail('unexpected page-accessible extension assets'),
  );
  assert(
    !manifest.externally_connectable,
    fail('external messaging is not approved'),
  );
  const csp =
    manifest.content_security_policy?.extension_pages ??
    "script-src 'self'; object-src 'self';";
  const scriptSources = csp
    .match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1]
    ?.trim();
  assert(
    scriptSources === "'self'",
    fail('extension script CSP must allow self only'),
  );

  const assets = [
    'engine.html',
    'popup.html',
    'options.html',
    'content-scripts/content.js',
  ];
  if (browser === 'chrome') {
    assert(
      typeof manifest.background?.service_worker === 'string',
      fail('service worker missing'),
    );
    assert(
      !manifest.background?.scripts,
      fail('Chrome must not use Firefox background scripts'),
    );
    assets.push(manifest.background.service_worker);
  } else {
    assert(
      !manifest.background?.service_worker,
      fail('Firefox must not use Chrome service worker'),
    );
    assert(
      manifest.background?.scripts?.length > 0,
      fail('Firefox background scripts missing'),
    );
    assert(
      manifest.background?.persistent !== true,
      fail('Firefox background must be event driven'),
    );
    assets.push(...manifest.background.scripts);
    const gecko = manifest.browser_specific_settings?.gecko;
    assert(
      gecko?.id === 'persistent-translate@kingjethro999.github.io',
      fail('stable Gecko ID changed'),
    );
    assert(
      JSON.stringify(gecko.data_collection_permissions?.required) ===
        '["none"]',
      fail('local-only data declaration changed'),
    );
    assert(
      !gecko.data_collection_permissions?.optional?.length,
      fail('cloud collection is not implemented'),
    );
  }
  assert(
    manifest.action?.default_popup === 'popup.html',
    fail('popup missing'),
  );
  assert(
    manifest.options_ui?.page === 'options.html' ||
      manifest.options_page === 'options.html',
    fail('options missing'),
  );
  for (const asset of new Set(assets))
    await readFile(localPath(directory, asset));
  for (const path of await walkFiles(directory)) {
    if (!path.endsWith('.html')) continue;
    const html = await readFile(path, 'utf8');
    for (const match of html.matchAll(
      /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi,
    )) {
      const asset = match[1];
      assert(
        !/^(?:[a-z]+:|\/\/)/i.test(asset),
        fail('remote page asset rejected'),
      );
      await readFile(localPath(directory, asset.replace(/^\//, '')));
    }
  }
  inventory[browser] = {
    manifestVersion: manifest.manifest_version,
    version: manifest.version,
    permissions: manifest.permissions,
    requiredHosts: manifest.host_permissions ?? [],
    optionalHosts: manifest.optional_host_permissions,
    contentScripts:
      'Registered only after an explicit site grant; top frame only.',
    background: manifest.background,
    ...(browser === 'firefox'
      ? { gecko: manifest.browser_specific_settings.gecko }
      : {}),
  };
  console.log(
    `${browser}: Manifest V3, version, permissions, background, CSP, and packaged assets verified.`,
  );
}

await writeFile(
  '.output/permission-inventory.json',
  `${JSON.stringify(inventory, null, 2)}\n`,
);
