import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { assert } from './package-utils.mjs';

const { name, version } = JSON.parse(await readFile('package.json', 'utf8'));
assert(
  execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'])
    .length === 0,
  'Commit source edits before creating a release source archive.',
);
const committed = JSON.parse(
  execFileSync('git', ['show', 'HEAD:package.json']).toString('utf8'),
);
assert(
  committed.version === version,
  'Committed package version differs from working tree.',
);
await mkdir('.output', { recursive: true });
const file = `.output/${name}-${version}-sources.zip`;
execFileSync('git', ['archive', '--format=zip', `--output=${file}`, 'HEAD']);
const commit = execFileSync('git', ['rev-parse', 'HEAD'])
  .toString('utf8')
  .trim();
await writeFile(
  '.output/build-provenance.json',
  `${JSON.stringify({ name, version, commit, sourceArchive: file.split('/').at(-1), node: process.version, packageManager: committed.packageManager, signing: 'unsigned', storePublication: false }, null, 2)}\n`,
);
console.log(`Archived committed source ${commit.slice(0, 12)} to ${file}.`);
