import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assert } from './package-utils.mjs';

const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const expiration = Date.parse('2026-11-26T00:00:00Z');
const advisoryId = 'GHSA-86w9-cpqp-85rv';
const advisoryUrl = `https://github.com/advisories/${advisoryId}`;
const developmentPath = '.>web-ext>@devicefarmer/adbkit>node-forge';

// Keep this review local to the exact finding. Never configure a global pnpm
// ignore: that would hide this advisory if it enters production or another tool.
function isReviewedException(advisory, now) {
  return (
    now < expiration &&
    advisory.id === 1240912 &&
    advisory.github_advisory_id === advisoryId &&
    advisory.url === advisoryUrl &&
    advisory.module_name === 'node-forge' &&
    advisory.severity === 'high' &&
    (advisory.patched_versions === '<0.0.0' ||
      advisory.patched_versions === null) &&
    advisory.findings.length === 1 &&
    advisory.findings[0].version === '1.4.0' &&
    advisory.findings[0].paths.length === 1 &&
    advisory.findings[0].paths[0] === developmentPath
  );
}

export function evaluateAudit(report, now = new Date()) {
  assert(
    report &&
      typeof report === 'object' &&
      report.advisories &&
      typeof report.advisories === 'object' &&
      !Array.isArray(report.advisories) &&
      report.metadata?.vulnerabilities &&
      !report.error,
    'Invalid audit report; dependency audit did not complete.',
  );
  assert(
    Array.isArray(report.muted) && report.muted.length === 0,
    'Audit report contains muted findings or an unsupported muted format.',
  );
  const timestamp = now.getTime();
  assert(Number.isFinite(timestamp), 'Invalid audit review date.');
  const counts = Object.fromEntries(
    severities.map((severity) => [severity, 0]),
  );
  const blocked = [];
  const excepted = [];
  for (const [key, advisory] of Object.entries(report.advisories)) {
    assert(
      advisory &&
        Number.isSafeInteger(advisory.id) &&
        String(advisory.id) === key &&
        typeof advisory.module_name === 'string' &&
        typeof advisory.github_advisory_id === 'string' &&
        severities.includes(advisory.severity),
      'Invalid audit report advisory identity or severity.',
    );
    assert(
      Array.isArray(advisory.findings) && advisory.findings.length > 0,
      'Invalid audit report findings.',
    );
    for (const finding of advisory.findings) {
      assert(
        finding &&
          typeof finding.version === 'string' &&
          Array.isArray(finding.paths) &&
          finding.paths.length > 0 &&
          finding.paths.every(
            (path) => typeof path === 'string' && path.length > 0,
          ),
        'Invalid audit report findings version or dependency path.',
      );
    }
    counts[advisory.severity]++;
    if (!['high', 'critical'].includes(advisory.severity)) continue;
    const destination = isReviewedException(advisory, timestamp)
      ? excepted
      : blocked;
    for (const finding of advisory.findings) {
      for (const path of finding.paths) {
        destination.push({
          id: advisory.github_advisory_id,
          registryId: advisory.id,
          module: advisory.module_name,
          severity: advisory.severity,
          version: finding.version,
          path,
        });
      }
    }
  }
  for (const severity of severities) {
    assert(
      Number.isSafeInteger(report.metadata.vulnerabilities[severity]) &&
        report.metadata.vulnerabilities[severity] === counts[severity],
      'Invalid audit report counts; findings may be missing.',
    );
  }
  return { blocked, excepted, counts };
}

const safe = (value) =>
  value.replace(/[^A-Za-z0-9/@.>:_-]/g, '?').slice(0, 300);

async function runAudit() {
  // No --prod, severity filtering, ignore list, or ignored registry errors:
  // inspect the complete report, including every development dependency.
  const audit = spawnSync('pnpm', ['audit', '--json'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120000,
  });
  assert(
    !audit.error && !audit.signal && [0, 1].includes(audit.status),
    'Dependency audit command failed; no security decision was made.',
  );
  let report;
  try {
    report = JSON.parse(audit.stdout);
  } catch {
    throw new Error(
      'Dependency audit returned invalid JSON; no security decision was made.',
    );
  }
  const result = evaluateAudit(report);
  assert(
    audit.status !== 1 ||
      Object.values(result.counts).some((count) => count > 0),
    'Dependency audit failed without a complete vulnerability result.',
  );
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  if (result.excepted.length > 0) {
    assert(
      packageJson.devDependencies?.['web-ext'] &&
        !packageJson.dependencies?.['web-ext'] &&
        !packageJson.optionalDependencies?.['web-ext'],
      'Reviewed exception requires web-ext to remain development tooling only.',
    );
    console.warn(
      `REVIEWED TOOLING EXCEPTION: ${advisoryId}, registry ID 1240912, node-forge@1.4.0, ${developmentPath}.`,
    );
    console.warn(
      'This unpatched high-severity finding remains present in web-ext Android development tooling. It is not shipped in the extension. Exception expires 2026-11-26T00:00:00Z; see SECURITY.md.',
    );
  }
  for (const finding of result.blocked) {
    console.error(
      `BLOCKED: ${safe(finding.severity)} ${safe(finding.id)} ${safe(finding.module)}@${safe(finding.version)} ${safe(finding.path)}`,
    );
  }
  console.log(
    `Complete dependency audit: ${JSON.stringify(result.counts)}; reviewed exceptions: ${result.excepted.length}; blocking findings: ${result.blocked.length}.`,
  );
  assert(
    result.blocked.length === 0,
    'Dependency audit rejected unexpected or expired high/critical findings.',
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await runAudit();
  } catch (error) {
    // Do not echo registry stderr, tokens, environment values, or raw responses.
    console.error(error.message);
    process.exitCode = 1;
  }
}
