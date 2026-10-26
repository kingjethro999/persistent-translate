# Persistent Translate

Translate once; stay translated across a website.

Persistent Translate is an early browser extension that remembers an explicitly chosen translation language for an exact website origin and reapplies that choice on the next page. The first development slice targets Spanish pages translated to English in desktop Chrome, with a selectable language pair.

**Development status:** Phase 0 architecture and Phase 1 implementation are in progress. Automated browser tests use a deterministic replacement for the native Translator API. They establish extension wiring and persistence; they do not establish native model availability or translation quality. See [TEST_PLAN.md](TEST_PLAN.md) for the evidence and open checks. This is not a store release.

## Browser and engine limits

| Target         | Current scope                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| Desktop Chrome | MV3 build; native Translator adapter, subject to the actual browser, platform and language-pair availability |
| Firefox        | Separate MV3 development build; translation provider unavailable in this phase                               |
| Edge           | Architecture target; engine and installation behavior not yet validated                                      |

The Chrome manifest floor is 138; that is an API baseline, not a claim that every Chrome 138+ device can translate. Firefox's configured minimum is 140, with no claim that Firefox exposes Chrome's Translator API.

## Build and install for development

Use Node.js 22.12+ and the pnpm version declared in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build:chrome
```

In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `.output/chrome-mv3`. An unpacked developer installation does not receive Chrome Web Store updates.

For Firefox, run `pnpm build:firefox`, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `.output/firefox-mv3/manifest.json`. This installation is temporary and translation remains unavailable. A normal release installation requires a Mozilla-signed add-on; no signed XPI is supplied by this phase. See [Mozilla's signing guidance](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

## Try the persistent flow

1. Open an ordinary HTTP/HTTPS page with Spanish text. Open the extension popup and choose Spanish as source and English as target.
2. Open the native engine setup page and explicitly prepare the language pair. Chrome may need to download a model. Keep the engine tab open while using this development version.
3. Choose **Always translate this site** and approve access to that website when the browser asks.
4. Follow a link to `/login` on the same origin. The new document resolves the saved rule and starts translation without opening the popup again.

If Chrome cannot expose or prepare the engine, the extension shows an unavailable/setup state and leaves original content intact. Closing the engine tab or restarting the browser may require opening engine setup again; the website rule remains saved. The engine tab is an explicit Phase 1 limitation, tracked in [DECISIONS.md](DECISIONS.md).

“This site” currently means the exact scheme, hostname and port, covering every path. A sibling subdomain or another scheme has its own rule. Browser host grants can be broader than this rule; content authorization still checks the exact origin. One-time translation does not create a saved rule.

## Development commands

| Command                                          | Purpose/output                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `pnpm dev:chrome` / `pnpm dev:firefox`           | WXT development server for the selected browser                                 |
| `pnpm build:chrome` / `pnpm build:firefox`       | Production MV3 directories under `.output/chrome-mv3` and `.output/firefox-mv3` |
| `pnpm zip:chrome` / `pnpm zip:firefox`           | WXT versioned browser ZIPs under `.output`                                      |
| `pnpm lint` / `pnpm typecheck` / `pnpm test`     | Formatting, static checks and Vitest                                            |
| `pnpm exec playwright install chromium`          | Install the Chromium test browser                                               |
| `pnpm test:e2e:chrome`                           | Playwright extension persistence checks                                         |
| `pnpm lint:firefox`                              | Validate actual Firefox output with web-ext                                     |
| `pnpm verify:manifests` / `pnpm verify:packages` | Permission and packaged-artifact checks after builds/ZIPs                       |
| `pnpm scan:secrets`                              | Repository secret-pattern scan                                                  |

The browser test fake is installed only by the test harness into extension documents. Production builds contain no fake translation provider and require no API key.

## Privacy and distribution

This phase has no cloud translation, analytics, accounts or persistent page-text cache. Settings and exact-origin rules stay in extension-local browser storage. Eligible page text is processed in local memory by the native engine. Chrome itself may download model files; that is distinct from sending text to a hosted translation provider. Read [PRIVACY.md](PRIVACY.md) before enabling website access.

CI checks source, both browser packages and Chromium behavior. The release workflow produces unsigned development artifacts, source and checksums in a draft GitHub release. Store publication and Mozilla signing require a later authorized release process. No store listing or signed distribution is claimed.

Read [PRD.md](PRD.md), [SPEC.md](SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [MIT](LICENSE).
