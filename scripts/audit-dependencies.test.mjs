import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateAudit } from './audit-dependencies.mjs';

const reviewedAt = new Date('2026-10-26T00:00:00Z');

function report() {
  return {
    actions: [],
    advisories: {
      1240912: {
        id: 1240912,
        github_advisory_id: 'GHSA-86w9-cpqp-85rv',
        module_name: 'node-forge',
        severity: 'high',
        patched_versions: '<0.0.0',
        url: 'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
        findings: [
          {
            version: '1.4.0',
            paths: ['.>web-ext>@devicefarmer/adbkit>node-forge'],
          },
        ],
      },
    },
    muted: [],
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 },
    },
  };
}

test('a clean complete audit passes without using an exception', () => {
  const clean = report();
  clean.advisories = {};
  clean.metadata.vulnerabilities.high = 0;
  const result = evaluateAudit(clean, reviewedAt);
  assert.deepEqual(result.blocked, []);
  assert.deepEqual(result.excepted, []);
  assert.equal(result.counts.high, 0);
});

test('only the reviewed advisory, version, and Android tooling path receives the temporary exception', () => {
  const result = evaluateAudit(report(), reviewedAt);
  assert.equal(result.blocked.length, 0);
  assert.equal(result.excepted.length, 1);
  assert.equal(result.excepted[0].id, 'GHSA-86w9-cpqp-85rv');
});

test('another advisory remains blocking even on the same dependency path', () => {
  const audit = report();
  audit.advisories[1240912].github_advisory_id = 'GHSA-aaaa-bbbb-cccc';
  assert.equal(evaluateAudit(audit, reviewedAt).blocked.length, 1);
});

test('a changed registry advisory ID remains blocking', () => {
  const audit = report();
  audit.advisories[1240912].id = 1240913;
  audit.advisories[1240913] = audit.advisories[1240912];
  delete audit.advisories[1240912];
  assert.equal(evaluateAudit(audit, reviewedAt).blocked.length, 1);
});

test('the same vulnerable package outside the reviewed Android path remains blocking', () => {
  const audit = report();
  audit.advisories[1240912].findings[0].paths = ['.>node-forge'];
  assert.equal(evaluateAudit(audit, reviewedAt).blocked.length, 1);
});

test('an additional dependency path cannot inherit the reviewed exception', () => {
  const audit = report();
  audit.advisories[1240912].findings[0].paths.push('.>another-tool>node-forge');
  assert.ok(evaluateAudit(audit, reviewedAt).blocked.length > 0);
});

test('a changed vulnerable version requires fresh review', () => {
  const audit = report();
  audit.advisories[1240912].findings[0].version = '1.4.1';
  assert.equal(evaluateAudit(audit, reviewedAt).blocked.length, 1);
});

test('the reviewed exception expires exactly at the start of November 26 UTC', () => {
  assert.equal(
    evaluateAudit(report(), new Date('2026-11-25T23:59:59Z')).excepted.length,
    1,
  );
  assert.equal(
    evaluateAudit(report(), new Date('2026-11-26T00:00:00Z')).blocked.length,
    1,
  );
});

test('critical escalation or an available patch invalidates the exception', () => {
  const escalated = report();
  escalated.advisories[1240912].severity = 'critical';
  escalated.metadata.vulnerabilities.high = 0;
  escalated.metadata.vulnerabilities.critical = 1;
  assert.equal(evaluateAudit(escalated, reviewedAt).blocked.length, 1);
  const patched = report();
  patched.advisories[1240912].patched_versions = '>=1.4.1';
  assert.equal(evaluateAudit(patched, reviewedAt).blocked.length, 1);
});

test('unexpected additional high advisories remain blocking', () => {
  const audit = report();
  audit.advisories[999] = {
    id: 999,
    github_advisory_id: 'GHSA-aaaa-bbbb-cccc',
    module_name: 'different-package',
    severity: 'high',
    findings: [{ version: '1.0.0', paths: ['.>different-package'] }],
  };
  audit.metadata.vulnerabilities.high = 2;
  const result = evaluateAudit(audit, reviewedAt);
  assert.equal(result.blocked.length, 1);
  assert.equal(result.excepted.length, 1);
});

test('malformed, muted, or inconsistent audit reports fail closed', () => {
  assert.throws(() => evaluateAudit({}, reviewedAt), /Invalid audit report/);
  const muted = report();
  muted.muted = ['GHSA-86w9-cpqp-85rv'];
  assert.throws(() => evaluateAudit(muted, reviewedAt), /muted/);
  const inconsistent = report();
  inconsistent.metadata.vulnerabilities.high = 0;
  assert.throws(() => evaluateAudit(inconsistent, reviewedAt), /counts/);
  const noFindings = report();
  noFindings.advisories[1240912].findings = [];
  assert.throws(() => evaluateAudit(noFindings, reviewedAt), /findings/);
});

async function cliFixture(auditOutput, exitCode) {
  const directory = await mkdtemp(join(tmpdir(), 'persistent-audit-cli-'));
  try {
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ devDependencies: { 'web-ext': '10.8.0' } }),
    );
    await writeFile(
      join(directory, 'pnpm'),
      `#!/usr/bin/env node
if (JSON.stringify(process.argv.slice(2)) !== '["audit","--json"]') process.exit(9);
process.stdout.write(${JSON.stringify(auditOutput)});
process.stderr.write('synthetic-registry-private-value');
process.exit(${exitCode});
`,
      { mode: 0o755 },
    );
    return spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./audit-dependencies.mjs', import.meta.url))],
      {
        cwd: directory,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${directory}${delimiter}${process.env.PATH}`,
        },
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test(
  'CLI runs the complete audit and accepts zero findings without an exception warning',
  { skip: process.platform === 'win32' },
  async () => {
    const clean = report();
    clean.advisories = {};
    clean.metadata.vulnerabilities.high = 0;
    const result = await cliFixture(JSON.stringify(clean), 0);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /reviewed exceptions: 0; blocking findings: 0/);
    assert.equal(result.stderr, '');
  },
);

test(
  'CLI rejects failed or malformed audits without printing registry contents',
  { skip: process.platform === 'win32' },
  async () => {
    for (const [output, code] of [
      ['{}', 2],
      ['not-json', 0],
      ['{"error":{"message":"synthetic-registry-private-value"}}', 1],
    ]) {
      const result = await cliFixture(output, code);
      assert.equal(result.status, 1);
      assert.doesNotMatch(result.stderr, /synthetic-registry-private-value/);
      assert.match(
        result.stderr,
        /audit.*(?:failed|invalid|Invalid)|Invalid audit report/i,
      );
    }
  },
);
