# Phase 0 and Phase 1 Implementation Plan

**Goal:** Remember an exact-origin translation choice and automatically translate the next full document at `/login`.

**Architecture:** WXT MV3 background owns rules, authorization and runtime registration. Isolated content scripts collect and patch text. An extension engine tab owns Chrome Translator instances because the API is unavailable in service workers. Native model setup is user initiated.

**Stack:** Strict TypeScript, WXT, pnpm, native DOM, Vitest/jsdom, Playwright Chromium, web-ext. **Spec:** [SPEC.md](SPEC.md), repository contract [AGENTS.md](AGENTS.md).

## Constraints and review focus

- No required universal host access, remote text transfer, remote code, or persistent text cache.
- Rules distinguish scheme, host, and port even though browser host patterns cannot restrict ports.
- Permission denial/revocation must leave a rule inactive; background restart must recover registrations.
- Late results after navigation, disable or target change must never patch the document.
- Inputs, code, editable regions, hidden text, inline language spans and newer site edits must survive translation and revert.
- Model setup/activation and headless native availability are explicit validation limits.

## P0 — repository baseline, boundaries and provider feasibility

- [x] Read the complete contract and inspect the empty directory, installed browsers and GitHub credentials.
- [x] Choose local-only Chrome Translator behind a document-context engine. Firefox provider work remains Phase 3.
- [ ] Write SPEC, PRD, ARCHITECTURE, DECISIONS, PRIVACY, TEST_PLAN and README.
- [ ] Scaffold WXT and locked pnpm dependencies, strict typing, lint and tests.

## P0 — independently testable persistence flow

**Interfaces:** `siteKey(url): string | null`; `RuleRepository.get/save/setEnabled/remove`; versioned `Preferences`; typed `TranslationJob`/`TranslationResult`; background messages validated at runtime. Engine ownership: `src/core/translate/native-chrome.ts`, `entrypoints/engine/*`; core ownership: repository, messages, content controller and popup.

- [ ] Write failing origin/migration/resolver and DOM safety tests; run RED.
- [ ] Implement canonical origins, forward-only migrations and serialized rule storage. Verify GREEN.
- [ ] Implement click-initiated optional host access and dynamic top-frame registration; store rule after permission grant.
- [ ] Implement bounded text collection, safe WeakMap patches, epoch cancellation and mutation handling.
- [ ] Implement native document engine, explicit setup/download status and safe unavailable result; no fabricated production translations.
- [ ] Implement compact accessible popup and basic saved-site options.
- [ ] Real Chromium E2E with a test-only native fake: `/` → `/login`, reload, new tab, input safety, pause/revert, permission removal, worker restart and zero text network egress. Fake exists only in tests.
- [ ] Probe installed Chrome's real API and record model availability; demonstrate native translation if platform permits.

## P1 — CI, packages and GitHub delivery

**Ownership:** QA/release agent owns `.github/`, `scripts/`, packaging documentation; primary owns final integration and Git operations.

- [ ] Actions: frozen install, lint, typecheck, tests, both browser builds, Firefox lint, manifest permission allowlist, package checks, secret scan, audit and E2E.
- [ ] Tag/manual release workflow: version-checked unsigned ZIPs, source archive, checksums, draft GitHub release; no store publication/signing.
- [ ] Verify all local commands, inspect generated manifests and artifacts, perform independent review.
- [ ] Create a public GitHub repository using authenticated `gh`, commit and push; verify remote Actions run and fix failures.

## P2 — subsequent work

Firefox consented BYO provider; comprehensive SPA/framework, BFCache, prerender and Shadow DOM coverage; attribute translation; performance profiling; production artwork and accessibility audit; signed/store release. These are outside the Phase 1 claim.
