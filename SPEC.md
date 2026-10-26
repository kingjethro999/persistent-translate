# Phase 0–1 specification

Revision: 2026-10-25. Repository contract: [AGENTS.md](AGENTS.md). Product intent: [PRD.md](PRD.md).

## Scope and acceptance

The first slice stores user intent and reapplies it to a fresh top-frame document. Its acceptance story is a Spanish fixture at `/`, an explicit English target and website permission, then a full navigation to `/login` that translates static labels without further popup interaction. Unit tests or a deterministic native fake alone cannot close the native-provider acceptance criterion.

| ID    | Requirement                                                        | Acceptance evidence                                                           |
| ----- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| P1-01 | Rule key is canonical HTTP/HTTPS origin, including nondefault port | Unit cases for paths, queries, schemes, subdomains, ports and restricted URLs |
| P1-02 | Save an enabled rule only after host access is granted             | Browser action and denied/revoked permission cases                            |
| P1-03 | New documents independently obtain saved intent                    | Browser `/` → `/login`, refresh and new-tab checks                            |
| P1-04 | Native engine availability and model setup are explicit            | Adapter tests and actual Chrome feature/model probe                           |
| P1-05 | Mutate eligible Text nodes only                                    | Protected fields, nested links, handlers and safe-revert checks               |
| P1-06 | Stale or malformed results cannot patch a document                 | Identity, epoch, result-size and detached-node tests                          |
| P1-07 | No translation-text network transfer or persistent text storage    | Runtime network inspection plus storage/source review                         |
| P1-08 | Unsupported pages and unavailable engines preserve original text   | Structured status/error checks                                                |
| P1-09 | Chrome and Firefox artifacts are distinct MV3 builds               | Generated manifest inspection and web-ext lint                                |

## Rule contract

Versioned preferences contain a default target and independent origin rules with source, target, enabled state and update time. Storage migration fails closed on unknown future schemas or invalid records. Serialized repository writes prevent one concurrent site update from losing another. No URLs with paths, page text or transient DOM state belong in persisted rules.

The applicable Phase 1 precedence is restricted URL → missing host access → document pause → disabled/no site rule → enabled site rule. Explicit one-time action is an ephemeral override. Site disable preserves the stored language choice; deletion is a separate action. Rule intent does not imply permission or engine readiness. Related-subdomain rules and global-language rules are deferred.

## Processing contract

Content scripts run in the isolated world and top frame. Each request has a request ID, document ID, document epoch, route epoch, exact origin, provider and validated language pair. Each response must match those identities and exactly the requested segment IDs. Check connection and unchanged source immediately before patching.

Collection excludes inputs, textareas, editable descendants, scripts, code, machine-readable text, hidden regions, explicit nontranslation regions and target-language spans. Values, markup and URL attributes are never changed. Original and last-applied text are reconciled in memory; revert only replaces an extension output that is still present. Attribute and Shadow DOM translation are deferred.

The queue and engine enforce payload, concurrency and timeout bounds. Empty or invalid output fails without erasing original text. No production fake, undocumented translation endpoint or cloud fallback is allowed. Source language is explicitly selected when uncertain; automatic detection is later work.

## Failure and compatibility contract

Status must distinguish permission, disabled/paused, setup, downloading, translating, translated/partial, unavailable and error states. “Translated” describes eligible processed text, not frames, images or the entire website. Permission removal stops future access and makes saved intent inactive. Background restart reconstructs authorization and registrations from storage.

Firefox is buildable but has no Phase 1 translation engine. Chrome's native path remains conditional on an actual ready language model. Model setup uses a visible extension tab whose lifetime is independent of the website document; closing it can require setup again. Browser restart preserves the rule but automatic native engine restoration is not yet demonstrated.

The full Phase 2+ matrix—including comprehensive SPA/framework, BFCache, prerender, accessibility and performance evidence—lives in [TEST_PLAN.md](TEST_PLAN.md). No complete cross-browser or release-ready claim follows from this slice.
