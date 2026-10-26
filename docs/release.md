# Builds and distribution

This project currently produces development previews. A GitHub artifact is not evidence of browser-store approval, Firefox signing, native-model availability, or complete cross-browser compatibility. Firefox has a separate MV3 build; its user-facing translation engine is unavailable in this phase. Review the current test evidence in TEST_PLAN.md before making compatibility claims.

## Automated checks

[CI](../.github/workflows/ci.yml) runs on branch pushes and pull requests. It also serves as the mandatory reusable gate for releases. It installs Node 22 and the exact pnpm version in package.json, installs the frozen lockfile, checks formatting/lint and types, runs Vitest, audits dependencies at high severity, builds both MV3 targets, runs web-ext lint, verifies manifests and packages, and runs the persistence tests in real Playwright Chromium. Deterministic test translation proves the extension lifecycle; it does not prove availability of Chrome's native translation models.

The source-file scanner never prints credential matches. A separately pinned Gitleaks action also examines Git history. GitHub Actions dependencies are pinned to exact commits; Dependabot proposes updates for review. Gitleaks may require a separate license if the repository is later moved into a GitHub organization. CI uses read-only repository permissions, and checkout does not persist credentials.

`pnpm audit:dependencies` evaluates the complete dependency report and blocks unexpected high/critical findings. One unpatched high-severity `node-forge@1.4.0` finding in the exact `web-ext` Android development-tooling path has a reviewed exception until **2026-11-26 00:00 UTC**. It remains visible in audit output and is not a clean-audit result. See [SECURITY.md](../SECURITY.md#temporary-exception-for-firefox-development-tooling) for the exact advisory, restrictions, rationale and removal deadline. The gate rejects changed or expired exceptions, a published fix, new paths, muted results, audit errors and malformed reports.

Successful runs retain unsigned browser ZIPs, committed source ZIP, SHA-256 checksums, permission inventory, and source-commit provenance for seven days. Browser test reports are uploaded when available, including on failure. A failing gate prevents artifact release. Review a failed dependency audit and update or explicitly document a narrowly scoped resolution; do not bypass the release checks.

## Reproduce a release build

Use a clean checkout of a committed version tag. The source archive intentionally refuses an uncommitted tree, so published sources match the recorded commit. Use Node 22.12 or newer; CI uses Node 22.

```sh
pnpm install --frozen-lockfile
pnpm scan:secrets
pnpm lint
pnpm typecheck
pnpm test
node --test scripts/*.test.mjs
pnpm audit:dependencies
pnpm build:chrome
pnpm build:firefox
pnpm verify:manifests
pnpm lint:firefox
pnpm zip:chrome
pnpm zip:firefox
pnpm verify:manifests
node scripts/create-source-archive.mjs
pnpm verify:packages --require-source
pnpm exec playwright install --with-deps chromium
xvfb-run -a pnpm test:e2e:chrome
```

`xvfb-run` is needed for the Linux headed browser tests and is provided by the CI runner; macOS/Windows can run `pnpm test:e2e:chrome` directly. Unit tests and browser tests require no production provider key. Remove stale ZIPs from `.output` before packaging another version. `wxt zip` rebuilds the relevant production target. The committed-source helper replaces WXT's default source ZIP because the complete Git snapshot includes the lockfile, hidden CI configuration, and documentation needed to reproduce the build.

For package version `0.1.0`, audited files are:

| Artifact                                         | Purpose                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| `.output/chrome-mv3/`                            | Unpacked Chrome/Chromium MV3 build                                        |
| `.output/firefox-mv3/`                           | Separate Firefox MV3 build                                                |
| `.output/persistent-translate-0.1.0-chrome.zip`  | Unsigned Chrome package                                                   |
| `.output/persistent-translate-0.1.0-firefox.zip` | Unsigned Firefox package                                                  |
| `.output/persistent-translate-0.1.0-sources.zip` | Exact committed source, without dependencies or private environment files |
| `.output/SHA256SUMS`                             | SHA-256 of release ZIPs and inventory/provenance                          |
| `.output/permission-inventory.json`              | Build-specific permissions and background configuration                   |
| `.output/build-provenance.json`                  | Source commit, version, runtime, and signing/publication status           |

The manifest audit requires exactly `storage`, `activeTab`, and `scripting`, no required host permissions, no static content script, and only optional `http://*/*` and `https://*/*` origin declarations. Runtime access is requested for a chosen website after an explicit click. Any widening requires a deliberate audit and privacy-document change. The Firefox audit checks an event-driven background, stable Gecko ID, and the current local-only `required: ["none"]` data declaration. Adding cloud translation requires re-evaluating that declaration and implementing consent before changing this guard.

The package audit validates ZIP integrity, safe filenames, size bounds, secret patterns, exact production-build contents, version consistency, and absence of fixture/test code in browser packages. Script/CSP checks reject common remote-executable patterns; they supplement human source review and dependency audits. They do not establish the absence of every possible malicious construct.

## Draft a GitHub release

1. Complete the release checklist below, update package.json and CHANGELOG.md, regenerate the lockfile if needed, commit, and push. Choose a stable `vX.Y.Z` tag matching package.json exactly.
2. Push that tag, or run **Draft release** manually with an existing version tag. Both paths run the full CI gate against the tagged commit. The workflow verifies package/tag/manifest versions and checksums, then creates an unpublished draft through `gh release create --draft --verify-tag`.
3. Review the draft notes and artifacts. Publishing the draft or submitting either store requires a separate maintainer decision and the appropriate approved accounts.

Only the final draft job receives `contents: write`. The default workflow token can create a GitHub draft; no signing credentials or store secrets are used. The workflow does not overwrite an existing release, create a missing tag, submit to a store, or deploy a translation service. A rerun against an existing draft requires reviewing or deleting that draft explicitly before retrying.

## Maintainer checklist before public distribution

- Re-run the documented real-browser native-model smoke test and record exact Chrome/browser/platform versions. Record Firefox's engine limitation and outstanding tests.
- Review the origin-permission inventory, Chrome privacy disclosures, and Firefox `data_collection_permissions` against the actual build. Confirm zero cloud-text egress remains enforced.
- Review privacy/support contact details, license, screenshots, accessibility, release notes, and known limitations. Do not imply that all phases are complete.
- Chrome users can load the unpacked directory via `chrome://extensions` → Developer mode → Load unpacked. Normal consumer distribution and updates require the Chrome Web Store process.
- Firefox developers can select the extracted `manifest.json` via `about:debugging` → This Firefox → Load Temporary Add-on. Stable persistent installation requires Mozilla signing; never advise disabling signature enforcement as the normal installation path.
- Any AMO upload needs the matching source archive and reproducible build instructions. Add a signed XPI only after Mozilla signing has actually succeeded and its version/integrity have been checked.

Official references checked during setup: [WXT packaging](https://wxt.dev/guide/essentials/publishing), [GitHub reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows), and [GitHub Actions security](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions). Browser-store requirements must be rechecked at submission time.
