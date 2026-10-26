# Security policy

Persistent Translate is a development project. There is no supported stable release or security-response SLA yet.

## Reporting a vulnerability

Use the repository's **Security → Report a vulnerability** option if private vulnerability reporting is enabled. Do not put page text, credentials, keys, exploit-bearing personal URLs or other private information in a public issue. A dedicated private maintainer security contact must be configured before store distribution; none is invented here.

For a non-sensitive hardening suggestion, a public issue with a synthetic fixture is appropriate. Include affected revision/browser version, expected behavior, a minimal reproduction and the permission/data-flow boundary involved. Never include a real account or private document in a reproduction.

## Threat model

Hostile page DOM, spoofed extension messages, stale asynchronous results, malicious translation strings, host-grant overreach and dependency compromise are relevant threats. Sensitive visible text remains sensitive even when form values are excluded.

The implementation separates isolated content, privileged background and extension engine contexts. It validates message senders/shape/size and exact-origin authorization. Patches use Text node values, never HTML parsing. It checks source identity and epochs before mutation, preserves newer site edits during revert, uses bundled code only, and requests optional host access after user action. Preferences contain no page contents or privileged credentials. No remote provider exists in Phase 1.

These controls require ongoing tests; they are not a claim of a complete security audit. Review actual generated manifests and executable bundles. CI's secret-pattern scanner is a baseline detection tool, not proof that no possible secret exists. Dependency audits must be assessed and remediated without silently ignoring advisories.

## Change review requirements

- Add tests for origin/permission widening, message types, network access or new data storage.
- Keep cloud engines disabled until operator identity, endpoint validation, affirmative consent and privacy disclosures are implemented.
- Do not add remote executable code, `eval`, dynamic function compilation, page-context credentials, broad required host access or undocumented vendor endpoints.
- Preserve user inputs and framework-owned markup. Reject malformed/stale provider responses without erasing source content.
- Signing and store credentials belong in approved repository environments/secrets, never source or build output.

## Temporary exception for Firefox development tooling

Reviewed on October 26, 2026; expires at **2026-11-26 00:00 UTC**. The complete dependency audit currently reports one unpatched high-severity advisory: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) (registry ID `1240912`), affecting RSA PKCS#1 v1.5 signature verification in `node-forge@1.4.0`. The registry lists no patched version at review time.

The reviewed dependency path is exactly `.>web-ext>@devicefarmer/adbkit>node-forge`. `web-ext` is a development dependency used for Firefox extension tooling. This transitive cryptography code serves its Android ADB tooling, which this desktop extension does not invoke. It is not a production extension dependency or bundled browser translation engine. The development dependency remains vulnerable; this is a temporary risk decision, not a vulnerability fix or a claim of a clean dependency audit.

`pnpm audit:dependencies` executes the complete `pnpm audit --json`, including development dependencies and every severity, then validates the result. It emits a visible warning for this one reviewed finding and blocks every unexpected high/critical finding. The exception requires the exact GHSA ID, numeric registry ID, package, version, severity and sole dependency path above; it requires `web-ext` to remain a development dependency. It expires automatically, and an available patch, changed version, additional path or critical escalation requires fresh review. Malformed, incomplete, muted or failed audit responses also block CI. No global pnpm advisory ignore is configured.

Before expiry, review upstream `web-ext`/ADB updates and remove this exception as soon as a supported fix is available. Do not use this exception to add Android tooling, expose the affected cryptographic operation, or ship `node-forge` in the browser bundle. The full audit still reports the vulnerability and should be included when describing release risk.
