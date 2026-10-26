import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { assert, readZip, walkFiles } from './package-utils.mjs';
import { secretFindings } from './scan-secrets.mjs';

const { name, version } = JSON.parse(await readFile('package.json', 'utf8'));
const sha256 = (contents) =>
  createHash('sha256').update(contents).digest('hex');
const expectedArchives = ['chrome', 'firefox'].map(
  (browser) => `${name}-${version}-${browser}.zip`,
);
const sourceName = `${name}-${version}-sources.zip`;
const actualArchives = (await readdir('.output'))
  .filter((file) => file.endsWith('.zip'))
  .sort();
assert(
  expectedArchives.every((file) => actualArchives.includes(file)),
  'Build both browser ZIPs first.',
);
assert(
  actualArchives.every((file) =>
    [...expectedArchives, sourceName].includes(file),
  ),
  'Unexpected or stale ZIP in .output; clean output before packaging.',
);
if (process.argv.includes('--require-source'))
  assert(
    actualArchives.includes(sourceName),
    'Committed source archive required.',
  );
const forbiddenPath =
  /(?:^|\/)(?:node_modules|\.git|\.wxt|\.output|coverage|test-results|playwright-report)(?:\/|$)/;

for (const archive of actualArchives) {
  const files = await readZip(`.output/${archive}`);
  const isSource = archive === sourceName;
  for (const [path, contents] of files) {
    assert(
      !forbiddenPath.test(path),
      `${archive}: build/private directory included`,
    );
    assert(
      secretFindings(path, contents).length === 0,
      `${archive}: secret scan rejected ${path}`,
    );
    if (isSource) continue;
    assert(
      !/(?:^|\/)(?:tests?|fixtures)(?:\/|\.)|\.map$|\.tsx?$|\.log$/.test(path),
      `${archive}: development source included: ${path}`,
    );
    assert(
      /\.(?:json|html|js|css|png|svg|webp|ico|woff2?)$/.test(path),
      `${archive}: unexpected production file: ${path}`,
    );
    if (/\.(?:js|html)$/.test(path)) {
      const code = contents.toString('utf8');
      assert(
        !/\beval\s*\(|\bnew\s+Function\s*\(/.test(code),
        `${archive}: dynamic executable code rejected: ${path}`,
      );
      assert(
        !/<script\b[^>]*\bsrc=["'](?:https?:)?\/\//i.test(code),
        `${archive}: remote script rejected: ${path}`,
      );
      assert(
        !/\bimport\s*\(\s*["']https?:/i.test(code),
        `${archive}: remote import rejected: ${path}`,
      );
      assert(
        !/fixture-translator|deterministic-test-engine/.test(code),
        `${archive}: test provider leaked into production`,
      );
    }
  }
  if (isSource) {
    for (const required of [
      'package.json',
      'pnpm-lock.yaml',
      'tsconfig.json',
      'wxt.config.ts',
      'README.md',
      'LICENSE',
      '.github/workflows/ci.yml',
      '.github/workflows/release.yml',
    ]) {
      assert(
        files.has(required),
        `${archive}: reproducible source file missing: ${required}`,
      );
    }
    assert(
      JSON.parse(files.get('package.json').toString('utf8')).version ===
        version,
      'Source archive version mismatch',
    );
  } else {
    const browser = archive.includes('-firefox.zip') ? 'firefox' : 'chrome';
    const directory = `.output/${browser}-mv3`;
    const built = await walkFiles(directory);
    assert(
      files.size === built.length,
      `${archive}: packaged file count differs from audited build`,
    );
    for (const path of built) {
      const entry = relative(directory, path).replaceAll('\\', '/');
      assert(files.has(entry), `${archive}: built asset missing: ${entry}`);
      assert(
        sha256(files.get(entry)) === sha256(await readFile(path)),
        `${archive}: asset differs from audited build: ${entry}`,
      );
    }
    const manifest = JSON.parse(files.get('manifest.json').toString('utf8'));
    assert(
      manifest.version === version && manifest.manifest_version === 3,
      `${archive}: manifest version mismatch`,
    );
  }
  console.log(
    `${archive}: ${files.size} files verified (${isSource ? 'committed sources' : 'unsigned browser package'}).`,
  );
}

const checksummed = [...actualArchives];
for (const file of ['permission-inventory.json', 'build-provenance.json']) {
  if ((await readdir('.output')).includes(file)) checksummed.push(file);
}
const checksums = await Promise.all(
  checksummed
    .sort()
    .map(
      async (file) => `${sha256(await readFile(`.output/${file}`))}  ${file}`,
    ),
);
await writeFile('.output/SHA256SUMS', `${checksums.join('\n')}\n`);
console.log(
  'SHA-256 inventory written to .output/SHA256SUMS. Static checks supplement source review; they are not a complete remote-code analysis.',
);
