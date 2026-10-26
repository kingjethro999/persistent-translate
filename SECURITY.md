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
