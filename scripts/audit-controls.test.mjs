import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import { archivePath, readZip } from './package-utils.mjs';
import { secretFindings } from './scan-secrets.mjs';

const scripts = dirname(fileURLToPath(import.meta.url));

// A tiny stored-ZIP writer keeps these adversarial validation tests independent
// of build tooling and system archive utilities.
function zip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [path, contents] of entries) {
    const name = Buffer.from(path);
    const data = Buffer.from(contents);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    localParts.push(local, name, data);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, directory, end]);
}

async function temporary(callback) {
  const directory = await mkdtemp(
    join(tmpdir(), 'persistent-translate-audit-'),
  );
  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('archive paths reject traversal, absolute paths, and Windows drive paths', () => {
  for (const path of [
    '../secret',
    '/secret',
    'a/../secret',
    'a\\secret',
    'C:/secret',
  ]) {
    assert.throws(() => archivePath(path), /Unsafe archive path/);
  }
  assert.equal(archivePath('assets/content.js'), 'assets/content.js');
});

test('ZIP validation accepts a valid archive and rejects corrupted contents', async () => {
  await temporary(async (directory) => {
    const path = join(directory, 'good.zip');
    const contents = zip([['manifest.json', '{"manifest_version":3}']]);
    await writeFile(path, contents);
    assert.equal(
      (await readZip(path)).get('manifest.json').toString(),
      '{"manifest_version":3}',
    );
    contents[30 + Buffer.byteLength('manifest.json')] ^= 1;
    await writeFile(path, contents);
    await assert.rejects(readZip(path), /checksum mismatch/);
  });
});

test('ZIP validation rejects duplicate entries and traversal', async () => {
  await temporary(async (directory) => {
    const path = join(directory, 'bad.zip');
    await writeFile(
      path,
      zip([
        ['duplicate.js', 'one'],
        ['duplicate.js', 'two'],
      ]),
    );
    await assert.rejects(readZip(path), /Duplicate ZIP entry/);
    await writeFile(path, zip([['../secret.txt', 'no']]));
    await assert.rejects(readZip(path), /Unsafe archive path/);
  });
});

test('secret scan identifies synthetic credentials and allows safe placeholders', () => {
  const synthetic = ['gh', 'p_', 'a'.repeat(36)].join('');
  assert.deepEqual(secretFindings('example.txt', Buffer.from(synthetic)), [
    'GitHub credential',
  ]);
  assert.deepEqual(
    secretFindings('.env.local', Buffer.from('PLACEHOLDER=true')),
    ['sensitive filename'],
  );
  assert.deepEqual(
    secretFindings('.env.example', Buffer.from('PUBLIC_VALUE=replace-me')),
    [],
  );
});

async function manifests(directory) {
  await writeFile(
    join(directory, 'package.json'),
    '{"name":"persistent-translate","version":"0.1.0"}',
  );
  for (const browser of ['chrome', 'firefox']) {
    const output = join(directory, '.output', `${browser}-mv3`);
    await mkdir(join(output, 'content-scripts'), { recursive: true });
    for (const asset of [
      'background.js',
      'content-scripts/content.js',
      'entry.js',
    ]) {
      await writeFile(join(output, asset), 'console.log("local asset");');
    }
    for (const html of ['engine.html', 'popup.html', 'options.html']) {
      await writeFile(
        join(output, html),
        '<!doctype html><script type="module" src="entry.js"></script>',
      );
    }
    const manifest = {
      manifest_version: 3,
      version: '0.1.0',
      permissions: ['storage', 'activeTab', 'scripting'],
      optional_host_permissions: ['http://*/*', 'https://*/*'],
      action: { default_popup: 'popup.html' },
      options_ui: { page: 'options.html' },
      background:
        browser === 'chrome'
          ? { service_worker: 'background.js' }
          : { scripts: ['background.js'] },
      ...(browser === 'firefox'
        ? {
            browser_specific_settings: {
              gecko: {
                id: 'persistent-translate@kingjethro999.github.io',
                data_collection_permissions: { required: ['none'] },
              },
            },
          }
        : {}),
    };
    await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest));
  }
}

test('manifest gate passes minimal per-browser builds and rejects required host access', async () => {
  await temporary(async (directory) => {
    await manifests(directory);
    execFileSync(process.execPath, [join(scripts, 'verify-manifests.mjs')], {
      cwd: directory,
    });
    const inventory = JSON.parse(
      await readFile(
        join(directory, '.output/permission-inventory.json'),
        'utf8',
      ),
    );
    assert.equal(inventory.chrome.manifestVersion, 3);
    const path = join(directory, '.output/chrome-mv3/manifest.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.host_permissions = ['<all_urls>'];
    await writeFile(path, JSON.stringify(manifest));
    const result = spawnSync(
      process.execPath,
      [join(scripts, 'verify-manifests.mjs')],
      { cwd: directory, encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /required host access is forbidden/);
  });
});

test('package gate rejects a ZIP modified after the production build was audited', async () => {
  await temporary(async (directory) => {
    await manifests(directory);
    execFileSync(process.execPath, [join(scripts, 'verify-manifests.mjs')], {
      cwd: directory,
    });
    for (const browser of ['chrome', 'firefox']) {
      const output = resolve(directory, '.output', `${browser}-mv3`);
      const entries = [
        'background.js',
        'content-scripts/content.js',
        'entry.js',
        'engine.html',
        'popup.html',
        'options.html',
        'manifest.json',
      ];
      const contents = await Promise.all(
        entries.map(async (path) => [path, await readFile(join(output, path))]),
      );
      await writeFile(
        join(directory, '.output', `persistent-translate-0.1.0-${browser}.zip`),
        zip(contents),
      );
    }
    execFileSync(process.execPath, [join(scripts, 'verify-packages.mjs')], {
      cwd: directory,
    });
    await writeFile(
      join(directory, '.output/chrome-mv3/background.js'),
      'console.log("newer build");',
    );
    const result = spawnSync(
      process.execPath,
      [join(scripts, 'verify-packages.mjs')],
      { cwd: directory, encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /asset differs from audited build/);
  });
});
