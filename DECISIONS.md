# Decisions and unresolved dependencies

Recorded: 2026-10-25. Recheck browser and store documentation before release.

| Decision                                        | Rationale / consequence                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| WXT, strict TypeScript and pnpm                 | Shared source with independently generated MV3 browser artifacts and a locked build                |
| Native DOM popup/options and content pipeline   | Keeps the first slice small and preserves webpage node identity                                    |
| Exact-origin rules                              | Paths share intent; schemes, subdomains and nondefault ports remain independent                    |
| Optional website grants                         | Core permissions are `storage`, `activeTab`, `scripting`; no required universal host access        |
| Chrome native engine in a visible extension tab | Gives the document-scoped API a user-activated setup context that survives website navigation      |
| No cloud implementation in Phase 1              | No validated provider/operator, funding, retention or consent flow has been supplied               |
| Firefox MV3 build, unavailable provider         | Build validation does not establish a usable Firefox translation engine                            |
| Deterministic native replacement only in tests  | Reproducible CI wiring without production fake results or online model prerequisites               |
| MIT for the initial source                      | No prior license existed; source distribution is authorized and no existing license is overwritten |
| Draft GitHub artifacts                          | Store signing/publication remains a separate authorized release action                             |

## Open decisions and validation

1. **Native Phase 1 evidence:** probe the actual installed Chrome build and language pair, prepare real model files, and demonstrate `/` → `/login`. Headless availability, API presence and fake-backed tests cannot substitute for that demonstration.
2. **Engine lifetime:** keeping an engine tab open is a documented development requirement. After browser restart/discard/close, saved rules survive but engine readiness may require intentional setup. A future automatic recovery approach must obey user activation and document lifecycle constraints.
3. **Firefox provider:** choose and validate either a consented BYO endpoint/gateway or a packaged local engine. If website content is transmitted, revisit Firefox's `websiteContent` declaration and built-in consent before shipping. No public free endpoint is assumed.
4. **Product release:** select a maintainer privacy/security contact, approve production icon artwork, complete browser/accessibility/performance evidence, and arrange signed/store distribution. None is inferred from having a ZIP.

## Official evidence register

Reviewed on 2026-10-25; these support architectural choices, not browser-test results.

| Source                                                                                                                                     | Relevant constraint                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [Chrome Translator](https://developer.chrome.com/docs/ai/translator-api)                                                                   | Pair availability, model setup, activation and execution-context limits |
| [Chrome extension AI](https://developer.chrome.com/docs/extensions/ai)                                                                     | Built-in AI integration entry point                                     |
| [Chrome worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)                         | Recover durable intent after worker termination                         |
| [Chrome permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions)                                               | Check and reconcile optional grants                                     |
| [Chrome match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)                                      | Host-pattern semantics differ from the rule model                       |
| [Mozilla background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)                      | Firefox MV3 event background differs from Chrome service workers        |
| [Mozilla browser settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings) | Gecko ID and accurate data collection declarations                      |
| [Mozilla signing](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)                                  | Normal Firefox release installation needs signing                       |
| [WXT publishing](https://wxt.dev/guide/essentials/publishing)                                                                              | Browser packaging and source-review workflow                            |

The configured Firefox ID is `persistent-translate@kingjethro999.github.io`; minimum 140.0 is a chosen development floor, not a tested support range. `data_collection_permissions.required: ["none"]` reflects the current absence of off-device collection. Any remote provider invalidates that assumption and requires another review.
