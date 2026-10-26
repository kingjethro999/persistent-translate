# Verification plan and evidence

Revision: 2026-10-25. A passing deterministic browser test proves persistence wiring in the tested browser; native translation acceptance requires a real model-backed run as well.

## Reproducible automated checks

Run from the repository root using the locked pnpm toolchain:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build:chrome
pnpm build:firefox
pnpm lint:firefox
pnpm verify:manifests
pnpm scan:secrets
node --test scripts/audit-controls.test.mjs
pnpm audit --audit-level high
pnpm exec playwright install chromium
pnpm test:e2e:chrome
pnpm zip:chrome
pnpm zip:firefox
pnpm verify:packages
```

On Linux without a display, run the browser command under `xvfb-run -a` when required by the Playwright configuration. CI installs the browser/system dependencies and runs this scope. Output ZIPs are unsigned development packages.

## Phase 1 evidence ledger

Results are pending final integration; this table must be updated with actual command output and versions before claiming checks passed.

| Layer                        | Planned evidence                                                                                                                            | Result               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Units / isolated DOM         | Origin/migration/write serialization, precedence, protected text, safe revert, protocol cardinality/epochs, native adapter lifecycle        | Pending              |
| Static/build                 | Lint, strict typecheck, separate Chrome/Firefox MV3 builds                                                                                  | Pending              |
| Firefox artifact             | web-ext lint with warnings treated as errors; stable ID, event-page background and no remote-data declaration                               | Pending              |
| Permission/package integrity | Exact core allowlist, optional HTTP/HTTPS patterns, archive paths/version and secret patterns                                               | Pending              |
| Chromium integration         | Real extension loaded in Playwright; deterministic native replacement; `/` → `/login`, reload, new tab, disable/revoke and restart behavior | Pending              |
| Text egress                  | Inspect extension runtime requests while fixture text is translated; reject outgoing fixture strings                                        | Pending              |
| Actual native engine         | Record Chrome binary/version/platform; feature/pair probe; real setup and Spanish → English output across navigation                        | Not yet demonstrated |
| Firefox runtime / Edge       | Actual installed browsers, lifecycle and usable translation engine                                                                          | Not yet demonstrated |

The native replacement is installed by test code into the extension engine document. It is absent from production source and packages. It may simulate ready/downloadable/unavailable outcomes and deterministic strings. Native translation quality, genuine download completion, offline success and user-activation behavior in installed Chrome remain separate checks.

## Manual native acceptance procedure

1. Record OS, exact Chrome version and hardware constraints. Build/load `.output/chrome-mv3` in a clean ordinary profile.
2. Start `node tests/fixtures/server.mjs` in a separate terminal and open `http://127.0.0.1:4173`. The same server is configured by `playwright.config.ts` for browser tests.
3. Set source `es`, target `en`. Open engine setup, click its preparation action and record API/pair availability and any download progress/failure. Keep the tab open.
4. On `/`, click **Always translate this site**, grant the requested host, and confirm a real native English heading plus unchanged input values/handlers.
5. Follow the ordinary `/login` link, then refresh and open the same origin in another tab. Confirm automatic local translation without another popup action and unchanged typed credentials.
6. Revoke host access, reload and confirm the stored rule is inactive. Re-grant intentionally; disable/revert while work is pending and confirm no late patch.
7. Restart Chrome with the profile intact. Record separately whether the rule persists and whether the engine needs setup again. Do not treat a saved rule as proof of automatic post-restart inference.
8. With required models prepared, test offline translation and record actual result. Do not infer offline support from API documentation.

Do not log private page text to create evidence. Use the public synthetic fixture and aggregate statuses.

## Follow-up matrix

These checks are required before the corresponding later milestone is closed; their presence is not a claim of current support.

| Area             | Remaining coverage                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permissions      | Denial/re-grant through actual browser prompt, persistent grant restart, origin/port/subdomain isolation, restricted pages and one-time access                |
| Lifecycle        | SPA push/replace state, DOM-only swaps, target change, back/forward, BFCache, prerender, duplicate tab, tab loss, engine-tab discard and extension reload     |
| DOM/framework    | Hydration, dynamic menus/modals, infinite scroll, attributes, open Shadow DOM, hidden ancestor changes, split inline text and framework-authored replacements |
| Language/quality | Unknown source confidence, nested languages, RTL/CJK, emoji, accents, whitespace and interpolation tokens                                                     |
| Resource limits  | 100/1,000/10,000 text nodes; processing slice time, cold start, first visible result, completion, memory and observer/queue bounds                            |
| Accessibility    | Keyboard, screen readers, zoom, contrast, reduced motion, light/dark and RTL popup/options                                                                    |
| Engine failures  | Real download failure, cancellation/timeout, unsupported pair, local offline success; remote cases only once a provider exists                                |
| Cross-browser    | Real Firefox event-page lifecycle and consented provider; installed Edge native feature probe; no mobile claim                                                |
| Distribution     | Chrome unpacked smoke, Firefox temporary load, source reproducibility, signed XPI only after actual signing, store disclosure review                          |

No hosted-provider tests are meaningful until an actual configured adapter exists. Future remote tests must cover consent/revoke, HTTPS validation, timeout/429/5xx/backoff, invalid or oversized responses and refusal to send editable values/cookies/full HTML.
