import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const rules = [
  ['private key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/],
  [
    'GitHub credential',
    /\bgh[pousr]_[A-Za-z0-9]{36,255}\b|\bgithub_pat_[A-Za-z0-9_]{40,255}\b/,
  ],
  ['OpenAI credential', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,255}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Google API credential', /\bAIza[A-Za-z0-9_-]{35}\b/],
  ['Slack credential', /\bxox[baprs]-[A-Za-z0-9-]{20,255}\b/],
];

export function secretFindings(name, contents) {
  const found = [];
  if (
    /(?:^|\/)(?:\.env(?:\..+)?|id_(?:rsa|ed25519)|credentials[^/]*\.json)$/i.test(
      name,
    ) &&
    !name.endsWith('.env.example')
  ) {
    found.push('sensitive filename');
  }
  if (!contents.includes(0)) {
    const text = contents.toString('utf8');
    for (const [label, pattern] of rules)
      if (pattern.test(text)) found.push(label);
  }
  return found;
}

async function scan() {
  const names = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      maxBuffer: 16 * 1024 * 1024,
    },
  )
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  let failures = 0;
  for (const name of new Set(names)) {
    let contents;
    try {
      contents = await readFile(name);
    } catch (error) {
      if (error.code === 'ENOENT') continue; // Deleted tracked files.
      throw error;
    }
    for (const finding of secretFindings(name, contents)) {
      // Never print matched credentials, file contents, or secret-bearing lines.
      console.error(`${name.replace(/[\r\n]/g, '')}: ${finding}`);
      failures++;
    }
  }
  if (failures) throw new Error(`Secret scan rejected ${failures} finding(s).`);
  console.log(
    `Secret scan passed (${new Set(names).size} source files; content is never logged).`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await scan();
}
