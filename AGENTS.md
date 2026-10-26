<?xml version='1.0' encoding='UTF-8'?>
<persistent_translate_agent_contract version="1.0" project="Persistent Translate" file="AGENTS.md" audience="OpenAI Codex and collaborating agents">
  <identity><![CDATA[
You are the principal engineer, systems architect, security reviewer, browser-extension specialist, and test engineer for Persistent Translate. Follow this contract whenever working inside the repository.

Project display name: Persistent Translate
Primary product promise: Translate once; stay translated across a website.
Tagline for public-facing copy, if needed: Translate webpages seamlessly.
Initial targets: Google Chrome (desktop), Mozilla Firefox (desktop), and Chromium-compatible Edge.
Open-source objective: a reproducible GitHub repository with store packages and documented manual-install paths.
Release policy: do not assert that something is published, signed, deployed, or supported without evidence.
Document precedence: user instructions > this AGENTS.md > applicable, narrower directory AGENTS.md > other project prose. Follow system/developer instructions from the tool environment in all cases. In conflicts involving security/privacy, escalate rather than silently weakening safeguards.
]]></identity>
  <mission><![CDATA[
Build a reliable, lightweight, accessible browser extension that remembers translation choices per website and applies them again when navigating from one path to another, reloading, opening another tab, returning later, or moving through client-side routes.

Illustrative acceptance story:
1. Spanish content appears at https://example.test/.
2. User explicitly chooses English and clicks “Always translate this site.”
3. The rule is stored for the site, with persistent host access if required by the browser.
4. The user navigates to /login, and the visible eligible text is automatically translated to English.
5. The user navigates to /dashboard by a React/Vue/Next.js client-side transition; newly rendered content is translated without another click.
6. The user refreshes, opens another tab, or restarts the browser; the preference still applies unless disabled or the required permission is revoked.
7. Form inputs, user-generated editable text, passwords, code, markup, and interaction behavior are not damaged.

DO NOT implement the product by assuming built-in Chrome Translate remembers an extension's state. Own the rule model and translation lifecycle. Do not imply that one-time DOM replacements survive a document navigation; reapply the stored rule on each eligible document or route.
]]></mission>
  <definition_of_persistence><![CDATA[
Persistence means persistence of USER INTENT plus automatic reapplication, not a magic permanently translated version of an external website.
- A document lasts only until navigation. A new document needs a new translation pass.
- URL path is NOT the default scope of a remembered rule.
- Default remembered scope: exact scheme+host origin, covering all paths on that origin. Treat ports explicitly where relevant.
- Do not silently grant a sibling subdomain the same access: https://app.example.test and https://auth.example.test can be different security origins.
- Provide an optional “entire site / related subdomains” preference only after clear UX, validated registrable-domain grouping, and permission grants for applicable origins. Never substitute a naïve split('.') approach for public-suffix-aware domain logic.
- Host permissions and user preference are separate objects. If a rule remains stored but permission is removed, mark it inactive and ask for permission when the user intentionally re-enables it. Never claim translation is running when it cannot run.
- Optional global “always translate selected source language” is an advanced feature. It needs explicit broad-access consent and must respect site exclusions and permissions; defer if security/policy reviews are unresolved.
- Pausing one tab or skipping a site must not unintentionally delete other saved rules.
]]></definition_of_persistence>
  <product_principles>
    <principle_1><![CDATA[
Reliable before flashy. Users must never wonder whether the next page will stay translated. Display clear persistent, paused, pending, unavailable, and failed states.
]]></principle_1>
    <principle_2><![CDATA[
Respect the original page. Preserve layout, links, events, focus, scroll, form state, keyboard behavior, and accessibility semantics. Never replace document.body.innerHTML or rebuild framework-owned DOM wholesale.
]]></principle_2>
    <principle_3><![CDATA[
Local-first privacy. Prefer on-device translation when supported; do not upload page text silently. Do not collect analytics, browsing history, authentication tokens, or entire HTML documents for translation.
]]></principle_3>
    <principle_4><![CDATA[
No invented compatibility. Test the actual browser/version/platform/engine combination. A supported extension manifest does not imply support for a particular built-in AI API.
]]></principle_4>
    <principle_5><![CDATA[
One core purpose. Translation continuity is the extension's purpose. Do not add unrelated AI chat, ads, account systems, referral mechanics, page summarization, or monetization logic to the MVP.
]]></principle_5>
    <principle_6><![CDATA[
Open-source, auditable, reviewable. No remotely hosted executable JavaScript; no eval/new Function; no obfuscated production bundles; no hidden data collection; no hardcoded privileged API keys.
]]></principle_6>
  </product_principles>
  <agent_execution_workflow>
    <first_actions><![CDATA[
1. Inspect existing repository root, git status, current code, package manager, tests, and existing AGENTS.md files before editing. Preserve user changes and existing working functionality.
2. If repository is blank, scaffold the minimum typed cross-browser project; do not assume files exist.
3. Read official API docs when a browser capability or store rule materially influences implementation. Record exact support or uncertainty instead of guessing.
4. Create/update SPEC.md, PRD.md, ARCHITECTURE.md, IMPLEMENTATION_PLAN.md, TEST_PLAN.md, PRIVACY.md, and README.md as living docs, but avoid duplicating requirements verbatim.
5. Break work into small, independently testable vertical slices. Implement the key / → /login persistence test before secondary polish.
6. Before writing each feature, state the interface, invariants, potential failure modes, and intended tests.
]]></first_actions>
    <coding_loop><![CDATA[
For every meaningful change: inspect → plan → implement → format/lint → typecheck → focused tests → browser smoke tests when feasible → inspect diff → concise report.
Use commits only when authorized by the operator or repository workflow. Do not force-push, wipe git history, delete user work, or rewrite secrets.
If a tool is unavailable, state what could not be verified, supply a reproducible command, and continue with verified tasks. Do not claim tests passed unless they actually ran.
]]></coding_loop>
    <decision_policy><![CDATA[
Use sound defaults when minor choices are ambiguous. Raise an explicit decision only for material blockers (e.g., hosted translation provider funding, privacy terms, or a permission/policy change). Design interfaces so those decisions can be made later without rewriting the content-script architecture.
Do not wait for confirmation on obvious scaffolding, typing, unit tests, local documentation, or reversible implementation improvements.
]]></decision_policy>
    <status_reports><![CDATA[
At the end of every Codex work session, report:
- What changed, with file paths.
- Which acceptance criteria were implemented.
- Exact tests/commands executed and results.
- Unverified assumptions and cross-browser risks.
- Remaining blockers and recommended next 1–3 steps.
No vague “done” if behavior has not been demonstrated in real browsers.
]]></status_reports>
  </agent_execution_workflow>
  <technical_stack>
    <required><![CDATA[
TypeScript strict mode. WXT as the cross-browser extension build framework, with Vite under the hood, unless a measured technical blocker is documented. React and Tailwind for the extension popup/options only if lightweight and well supported; use isolated content scripts and native DOM APIs for page translation. Prefer pnpm for dependencies unless this repository already has an established package manager and lockfile. Browser API typing and/or webextension-polyfill for consistent, Promise-oriented APIs where appropriate.
]]></required>
    <test_tooling><![CDATA[
Vitest for units and integration logic; jsdom or happy-dom for isolated DOM behavior, with explicit recognition that mock DOMs cannot prove real webpage/framework compatibility. Playwright for Chromium browser extension end-to-end checks. For Firefox, use web-ext, real Firefox automation where robustly supported, and repeatable manual testing. Run web-ext lint and test actual Firefox build output. Consider axe-core for popup accessibility, ESLint, Prettier, TypeScript, and dependency/security audits.
]]></test_tooling>
    <build_outputs><![CDATA[
Separate Chrome/Chromium Manifest V3 and Firefox Manifest V3 builds, using browser-specific background configuration generated/verified by WXT. Keep source modules shared. Never copy a Chrome service_worker-only manifest unchanged to Firefox. Ensure Firefox has a stable Gecko extension ID and current required data collection declarations. Do not default to Manifest V2 for store submissions. Keep version and release metadata consistent.
]]></build_outputs>
    <avoid><![CDATA[
No custom browser engine, web proxy, browser-driver requirement, scraping undocumented Google Translate endpoints, DOM screenshot OCR approach, full-page re-render library, broad runtime code injection, unreviewed third-party translation SDK, hardcoded private backend credentials, or mandatory account/signup for basic on-device translation.
]]></avoid>
  </technical_stack>
  <proposed_repository_structure><![CDATA[
Use this as an adaptable reference, not an excuse to restructure an existing repository unnecessarily:

persistent-translate/
  AGENTS.md
  README.md
  SPEC.md
  PRD.md
  ARCHITECTURE.md
  IMPLEMENTATION_PLAN.md
  TEST_PLAN.md
  PRIVACY.md
  SECURITY.md
  CONTRIBUTING.md
  CHANGELOG.md
  LICENSE
  package.json
  pnpm-lock.yaml
  tsconfig.json
  wxt.config.ts
  .env.example
  .gitignore
  .github/
    workflows/{ci.yml,release.yml}
    ISSUE_TEMPLATE/
  public/
    icons/{16.png,32.png,48.png,128.png,512.png}
  entrypoints/
    background.ts
    content.ts
    popup/{index.html,main.tsx,Popup.tsx}
    options/{index.html,main.tsx,Options.tsx}
  src/
    core/
      domain/{site-key.ts,public-suffix.ts}
      rules/{types.ts,resolver.ts,rule-repository.ts,migrations.ts}
      translate/{orchestrator.ts,engine.ts,native-chrome.ts,remote-provider.ts,language.ts,batching.ts,cache.ts}
      dom/{collector.ts,exclusions.ts,patcher.ts,mutation-manager.ts,visibility.ts,shadow-roots.ts}
      lifecycle/{navigation.ts,epoch.ts,controller.ts}
      messaging/{protocol.ts,validators.ts}
      permissions/{host-permission.ts}
      privacy/{content-filter.ts,disclosure.ts}
      utils/{errors.ts,logger.ts}
    ui/{components,styles,theme,assets}
  packages/      # optional, only if a hosted translation service is actually required
    translation-gateway/
  tests/
    unit/
    integration/
    fixtures/
      traditional-site/{index.html,login.html,dashboard.html}
      spa-site/
      dynamic-site/
      mixed-language/
      protected-fields/
    e2e/
  scripts/{verify-packages.mjs,check-permissions.mjs}
  docs/{architecture-decisions,release,manual-install,troubleshooting}

Only create folders and services that implementation uses. A simple MVP is preferable to architectural theater.
]]></proposed_repository_structure>
  <architecture_and_boundaries><![CDATA[
A. Popup / options: collect explicit user intent, show translation state and settings. Must not crawl the page directly.
B. Background: coordinates privileged browser APIs, host permissions, preference storage, messaging, remote translation calls (if consented), and supported navigation signals. No DOM access should be assumed in a Chromium service worker.
C. Content script (isolated world): examines eligible rendered page text, owns mutation observers, records original text and safe patches, detects eligible DOM updates, handles pause/revert, and reports progress. Treat the page as untrusted.
D. Rule repository: sole authority on persisted site-language choices. Versioned and migration-safe.
E. Engine abstraction: browser-native translation and explicit remote provider behind one typed contract; identical text-segmentation pipeline independent of engine.
F. Translation orchestrator: per-document bounded queue, deduplication, cancellation/stale-work rejection, result validation, and status accounting.
G. Browser adapters: isolate Chrome/Firefox differences, feature-detect capabilities, make unsupported operations visible to the user.

No component may rely on an immortal background process. Chrome MV3 service workers can go idle and restart. Persist preferences immediately and recover from reinitialization. Document-specific translation state belongs in the living content script and is reconstructable; do not store Text node references in background storage.
]]></architecture_and_boundaries>
  <required_type_contracts><![CDATA[
Suggested TypeScript contracts (adapt as implementation needs, preserving semantics):

type LanguageCode = string; // Validate/canonicalize BCP 47 tags where possible.
type TranslationMode = 'off' | 'once' | 'always-origin' | 'always-site' | 'global-language';
type ProviderId = 'chrome-native' | 'self-hosted' | 'byok';
type SourceLanguage = LanguageCode | 'auto';

interface OriginRule {
  id: string;
  key: string;                       // canonical scheme/hostname/port, NOT pathname
  targetLanguage: LanguageCode;
  sourceLanguage: SourceLanguage;
  enabled: boolean;
  scope: 'origin' | 'registrable-domain';
  providerPreference: 'local-first' | ProviderId;
  updatedAt: number;
  schemaVersion: number;
}

interface TranslationPreferences {
  schemaVersion: number;
  defaultTargetLanguage: LanguageCode;
  perOriginRules: Record<string, OriginRule>;
  excludedOrigins: string[];
  globalLanguageRules: Record<string, LanguageCode>;  // advanced/opt-in only
  cloudConsentByProvider: Record<string, boolean>;
  allowTextCache: boolean;            // false by default; avoid persistence of page contents
}

interface TranslationJob {
  requestId: string;
  documentEpoch: number;
  routeEpoch: number;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  segments: readonly { id: string; text: string }[];
  originKey: string;
  provider: ProviderId;
}

interface TranslationResult {
  requestId: string;
  documentEpoch: number;
  routeEpoch: number;
  segments: { id: string; translatedText: string }[];
}

interface TranslationEngine {
  id: ProviderId;
  isAvailable(context: { source: string; target: string }): Promise<boolean>;
  translate(job: TranslationJob, signal?: AbortSignal): Promise<TranslationResult>;
  dispose?(): Promise<void>;
}

type TranslationStatus =
  | 'unsupported-page' | 'permission-needed' | 'consent-needed'
  | 'disabled' | 'ready' | 'detecting' | 'downloading-model'
  | 'translating' | 'translated' | 'partially-translated'
  | 'paused' | 'provider-unavailable' | 'rate-limited' | 'error';

Requirements:
- Runtime-validate messages from tabs/pages; compile-time types alone are not a security boundary.
- Include tab/document/epoch IDs in async messages so stale responses are ignored.
- Build an explicit forward-only preference migration path with an integrity test.
- Never put raw page text into sync storage, persistent logs, crash reports, or URLs.
]]></required_type_contracts>
  <rule_precedence_and_lifecycle>
    <precedence><![CDATA[
Resolve in this descending order, with tests: unsupported/restricted URL → missing host permission → explicit tab pause → explicit site exclusion → disabled site rule → enabled site rule → user-approved global language rule → manual one-time session → no translation. A one-time session may temporarily override a stored site rule only after explicit user action. Apply target-language equality checks to skip no-op translation. Prefer most specific rule to broad rule.
]]></precedence>
    <startup><![CDATA[
At document start or earliest safe opportunity: initialize the content controller, ask the rule resolver for an applicable preference, verify host access and engine availability, and run an incremental translation pass as soon as eligible content exists. Do not wait for an unrelated popup to open. Handle user-granted access changes, install/update, and restarted background contexts.
]]></startup>
    <traditional_navigation><![CDATA[
On a full browser navigation from / to /login or /dashboard, the new content script instance independently resolves the saved rule and translates eligible content. Validate document identity, active tab state, and the current origin before mutating. Show no extra language popup for a previously authorized origin.
]]></traditional_navigation>
    <spa_navigation><![CDATA[
Observe route changes via appropriately permissioned extension webNavigation history-state signals and content-side navigation/DOM lifecycle fallback. Do not silently monkey-patch host page history methods in MAIN world. Correctness must not depend on a single history event; changes may be purely DOM-based without URL updates. Increment the route epoch and cancel/ignore stale work. Debounce bursty re-renders, but do not introduce noticeable fixed delays on every route.
]]></spa_navigation>
    <dynamic_content><![CDATA[
One MutationObserver per eligible document or controlled root, with safe observer management. Observe added nodes, meaningful text changes, and relevant attribute changes; avoid feedback loops caused by our own updates. Batch work, dedupe identical segments, and disconnect observers on deactivation. Support append/infinite-scroll, route modals, tabs, menus, hydration, deferred widgets, and Shadow DOM when an open shadow root is observable. Report closed shadow roots and forbidden frames as limitations.
]]></dynamic_content>
    <iframe_policy><![CDATA[
Default to top-frame translation only for MVP unless frame handling is safe and tested. Offer frame coverage only with required separate host permissions, all_frames settings, and privacy disclosure. Cross-origin iframe restrictions are normal and must not be bypassed. Never claim complete translation if unaccessible frames remain.
]]></iframe_policy>
    <tab_events><![CDATA[
Refreshes, new tabs, browser restart, tab duplication, back/forward navigation, BFCache restores, prerender activation, and extension reload each need explicit tests. Session-only pause can reset on new document or tab close, but the rule must persist if user selected “Always.” Handle tabs lost mid-translation without uncaught promises.
]]></tab_events>
  </rule_precedence_and_lifecycle>
  <dom_safety_and_translation_rules>
    <eligible_nodes><![CDATA[
Translate visible human-readable text nodes under standard content elements such as headings, paragraphs, links, lists, labels, navigation items, and button captions where doing so cannot break functionality. Use TreeWalker/NodeFilter carefully, not broad innerHTML string replacement. Only modify Text.nodeValue/textContent on the exact Text node selected; preserve surrounding HTML, nested markup, and event handlers. Support eligible title/alt/aria-label/placeholder with a separate attribute strategy and tests. Never modify form values.
]]></eligible_nodes>
    <exclusions><![CDATA[
Always skip script, style, noscript, template, svg/path data, code, pre, kbd, samp, textarea, input values, select values, [contenteditable], [translate="no"], translate="no" ancestors, explicit no-translate classes/attributes, hidden/nonrendered regions where possible, extension-owned UI, and sensitive descendants. Do not translate JSON-LD, URLs, href/src/action attributes, embedded code editors, browser download fields, or structured machine-readable data. Honor HTML lang markers and explicit nested-language spans.
]]></exclusions>
    <sensitive_text><![CDATA[
Never inspect or transmit password fields, payment form fields, OTPs, private editable text, or raw auth/session material. Do not read cookies/localStorage/sessionStorage from page context. On authentication, payment, medical, finance, or account-management pages, apply conservative rules, support per-origin disabling, and prefer local-only engines. Automated PII detection is inherently imperfect; don't market an absolute “zero-sensitive-content” guarantee. If cloud translation is enabled, clearly explain that visible page text may contain sensitive content. When uncertainty exists, choose not to transmit.
]]></sensitive_text>
    <avoid_corruption><![CDATA[
Record the original value and last applied translation for every patched Text node or attribute using WeakMap-based metadata, with a minimal reconciliation policy. When restoring, revert only if the live value still equals the text inserted by this extension; never overwrite newer app edits. Detect site changes since patching and treat newly authored text as fresh source instead of recursively retranslating translated output. Do not use persistent HTML data flags that sites might accidentally duplicate.
]]></avoid_corruption>
    <race_safety><![CDATA[
Every page/route increments an epoch. Validate node.isConnected, original value, rule status, document/route epoch, provider ID, and target language before applying a translation response. Discard obsolete results. Handle user clicking Disable or switching English→French mid-flight, provider timeout, or page navigation. Abort where supported; stale-result guards are mandatory even if abort is unavailable.
]]></race_safety>
    <translation_quality><![CDATA[
Preserve punctuation, whitespace boundary conditions, Unicode normalization, emojis, bidirectional text, locale directionality, proper nouns, interpolation placeholders, and inline tags. Translate complete phrases or semantic blocks when practical rather than isolated words, but never flatten arbitrary HTML or destroy links. Source-language detection should use html[lang] as a hint, optional language detector, sampled visible text, and confidence checks. If uncertain, ask or skip rather than repeatedly mistranslate. Do not translate already-target-language segments, numbers-only segments, or trivial symbols.
]]></translation_quality>
    <security><![CDATA[
Treat both page DOM and remote provider responses as untrusted data. Never insert translated strings with innerHTML, insertAdjacentHTML, unsafe template interpolation, or eval. Use textContent/Text.nodeValue and safe extension DOM creation. Validate protocol messages, translation response cardinality, payload sizes, and provider URLs. Protect against content-script/page messaging spoofing and origin confusion.
]]></security>
  </dom_safety_and_translation_rules>
  <translation_engine_policy>
    <engine_selection><![CDATA[
Local-first provider selection:
1. Feature-detect supported browser-native on-device translation for current language pair/context.
2. When model availability indicates downloadable, disclose download cost/size where known, show accurate progress, and await readiness before attempting translation; obey API lifecycle/dispose semantics.
3. If native translation is unavailable or unsupported, offer an explicitly enabled, privacy-disclosed remote provider. Do not silently send content externally.
4. If no consented provider works, show “Translation engine unavailable” with actionable setup/options rather than a blank panel or an unsupported-language claim.
5. Never silently switch from on-device to cloud because of an error; require previously granted affirmative cloud consent for that provider.
]]></engine_selection>
    <chrome_native><![CDATA[
Investigate Chrome desktop Translator and Language Detector APIs with runtime feature detection. Chrome 138 introduced relevant extension support, but exact capabilities vary by platform, language pair, browser settings, and model availability. Use the documented Translator.availability and Translator.create interfaces where supported; feature probe the real execution context (content script, extension page, worker) before selecting where translation runs. Model-download state and failures must be visible. No promise of Chrome Android support based solely on desktop API support. Do not treat an unsupported source-target pair as a universal extension failure.
]]></chrome_native>
    <firefox_engine><![CDATA[
DO NOT call Chrome's Translator API in Firefox or assume Firefox's user-facing built-in translation feature is exposed as an extension JavaScript API. Verify first. Firefox must have a supported, testable route: an operator-configured hosted translation gateway (after user consent), a user-provided endpoint/key, or a genuinely tested packaged local model later. If no service is configured, Firefox can ship with a working BYO endpoint flow, but it must not be advertised as fully plug-and-play for every language.
]]></firefox_engine>
    <remote_provider_contract><![CDATA[
Implement a transparent, configurable HTTPS translation endpoint adapter with clear request/response schema, supported pairs, bounded payloads, authentication method where needed, timeouts, retry/backoff for transient errors, quota reporting, and provider-specific errors. Provide LibreTranslate-compatible adapter where licensing/version compatibility is verified, or build a thin translation gateway abstraction; avoid reliance on unstable, unofficial public endpoints. Browser-side API keys cannot be kept secret: never ship a privileged vendor secret in an extension bundle. For maintainer-hosted providers, keep privileged credentials on a server under operator control. User-provided keys are disclosed as user-controlled secrets, stored as safely as the platform permits, never logged, and are not “secure from the user's own browser” by design.
]]></remote_provider_contract>
    <provider_privacy><![CDATA[
Prior to first cloud translation, tell users exactly what leaves the device (eligible text chunks, source/target languages, and necessary transport metadata), identify the third party, retention policy and geography if known, and ask for affirmative opt-in. No background provider contact for text without consent. Provide revoke/clear consent and disabled network mode. Enforce HTTPS with endpoint validation (permit loopback HTTP in explicit development mode only). Avoid transmitting full URL/query strings, credentials, entire HTML, cookies, or user-editable form contents.
]]></provider_privacy>
    <batching_and_caching><![CDATA[
Batch modestly (configurable char/segment limits) without giant requests or abusive per-word calls. Use bounded concurrency, debouncing, backpressure, cancellation, exponential backoff with jitter, and response validation. Keep an in-memory dedup cache for identical language/provider/segment combinations. Any persistent translation cache must be an opt-in advanced setting with size cap, TTL, clear button, and documented local privacy implications. Never use browser sync storage for page text. Avoid long-lived backend-side user page text storage by default.
]]></batching_and_caching>
    <offline_behavior><![CDATA[
If the local engine and needed language packs are available, previously permitted pages should translate without network connectivity. If translation requires a server, show offline/unavailable state and preserve original text; do not block navigation. Do not describe remote results as “offline translation.”
]]></offline_behavior>
  </translation_engine_policy>
  <permission_strategy><![CDATA[
Mandatory goal: persistent translation across navigation WITHOUT requesting universal access on install.

Recommended MVP:
- Use minimal core permissions such as storage, activeTab, and scripting as actually required by implementation.
- For manual one-time translation, activeTab may permit execution on the invoked tab, but it is TEMPORARY and cannot be the sole basis for “always translate this site.”
- Declare optional HTTP/HTTPS host match patterns with browser-appropriate Manifest V3 syntax; request a specific site's origin only from a clear, user-initiated click (“Always translate this site”).
- Save the durable origin rule only after checking that the corresponding access is granted, or store it explicitly as pending permission with accurate UI. Avoid lying about success if request is denied.
- Use browser.permissions.contains and onAdded/onRemoved, or appropriate equivalents, to reconcile stale rules and revoked grants.
- Where appropriate, register persistent content scripts for granted origins or use a well-tested dynamic injection flow; ensure new /login documents start processing without a popup action. Validate browser-specific registration behavior and race conditions.
- Optional related-subdomain behavior must use explicit host patterns and consents; a registrable-domain rule alone does not provide browser host permission.
- Do NOT add <all_urls> to required permissions by default. A globally translating mode may request broad optional access only after a clearly explained, intentional user action, if policy permits it.
- Don't request cookies, history, webRequest, debugger, downloads, clipboard, nativeMessaging, or broad tabs metadata unless a demonstrable current feature requires them.
- Restricted URLs (chrome://, about:, browser extension stores, PDF viewers, file:// without permission, etc.) must be recognized as unsupported/permission-dependent and explained. Never attempt to circumvent protected pages.
- For every browser build, generate a permission inventory and surface it in release notes/privacy policy.
]]></permission_strategy>
  <manifest_and_runtime_cross_browser><![CDATA[
- Target Manifest V3 on Chrome and Firefox; verify WXT produces valid per-target manifests.
- Chrome MV3 background uses service_worker; Firefox MV3 uses background scripts/event pages in the compatibility model documented by Mozilla. Do not blindly assume worker APIs are available in Firefox. Keep startup listeners top-level and event-driven.
- Firefox signing requires a stable browser_specific_settings.gecko.id. Firefox AMO requires accurate data_collection_permissions declarations; as of November 2025 these apply to new submissions. If optional cloud translation transmits websiteContent, determine the correct required/optional manifest disclosure and product consent flow instead of inaccurately declaring none.
- Chrome publisher policies require narrow permissions, user-data transparency, and suitable privacy policy; a translation service touching site content has real privacy implications.
- Use browser feature detection for webNavigation, scripting.registerContentScripts, built-in AI APIs, and storage behavior. Document version floors based on validated necessity.
- Browser-background termination is normal; every request and preference update must remain resilient and idempotent.
- Do not ship untrusted remote executable code, remotely fetched logic, eval, or loosened CSP to work around packaging defects.
]]></manifest_and_runtime_cross_browser>
  <user_experience_design>
    <primary_popup><![CDATA[
Minimal, fast popup (~320–380 CSS px wide) with:
- State indicator: site supported?, current page language (with “uncertain” when appropriate), target language.
- Main action: “Translate & remember this site” / “Always translate this site” when not active; “Pause on this site” / “Resume translation” when active.
- Secondary action: “Translate this page only.”
- Clear target language dropdown searchable when language list grows; default target from browser locale/user choice, never assume English for everybody.
- Visible status: translating, complete, unsupported, failed, requires permission, downloading language model, remote-provider consent.
- Tiny access to Options and Privacy. Never cover webpage content with an involuntary modal.
]]></primary_popup>
    <options><![CDATA[
Manage saved websites and rules with search; change target language per site; remove/exclude sites; pause per site; configure preferred engine; clearly opt in to cloud and view cloud provider privacy; configure BYO endpoint; see diagnostics without raw page text; clear local caches and preferences; import/export non-sensitive configuration only (optional post-MVP). Make permission granting/revocation transparent; use confirmation before broad-scoped changes.
]]></options>
    <visual_identity><![CDATA[
Modern liquid-glass, mono-white extension identity against forest green (rather than retro), consistent with the latest requested direction for Persistent Translate. Design restrained translucent surfaces, subtle depth, crisp typography, minimal animation, and reliable WCAG contrast; glass is cosmetic and must never compromise readability. Use a compact 'es/en' mark with a shallow mountain cutout where artwork is provided/approved. Do not assume an AI preview image is licensed/production-ready icon artwork. Rebuild or obtain approved source assets, then export crisp 16/32/48/128/512 PNG as needed. Do not rely on gradients or small decorative details to communicate state at favicon size.
]]></visual_identity>
    <accessibility><![CDATA[
Keyboard complete, semantic labels, focus visible, screen-reader status updates with aria-live used sparingly, reduced-motion support, 44px-ish touch targets where sensible, responsive popups, light/dark system appearance, proper RTL mirroring and isolation, large zoom text, color-independent status labels. Avoid focus theft during translation; DOM content changes may impact screen readers, so patch progressively and minimally.
]]></accessibility>
    <first_run><![CDATA[
No account required. Explain in 2–3 screens or fewer: what persists, what pages are accessible, and whether selected engine sends webpage text off-device. Ask for a site permission only after the user explicitly chooses persistence for that site. Do not request cloud consent as a precondition of using a supported local provider.
]]></first_run>
  </user_experience_design>
  <security_privacy_threat_model>
    <threats><![CDATA[
Hostile webpage DOM, DOM clobbering, content script message spoofing, XSS through translations, accidentally sending credentials, leaked API keys, CSRF to a translation gateway, host permission overreach, insecure custom endpoints, cross-origin frame confusion, rogue browser extension environments, malicious dependency updates, vendor rate limits and logging, and sensitive text appearing in visible page DOM.
]]></threats>
    <mitigations><![CDATA[
Keep content scripts in isolated execution world. Avoid MAIN-world scripts unless unavoidable and specifically reviewed; never place secrets in page context. Validate all message types/sizes and sender identity using extension context metadata. Sanitize/validate endpoint URLs and responses; no HTML injection. Keep HTTPS, reasonable CSP, no remote code, locked dependencies, reproducible builds, secret scanning in CI, and basic rate limiting/abuse protection for hosted endpoints. Minimize permissions and apply principle of least privilege.
]]></mitigations>
    <sensitive_sites><![CDATA[
Support exclusions and a default conservative posture for financial, authentication, and other sensitive contexts. Do not attempt to infer all sensitive pages perfectly from URL keywords alone; teach users exactly what is and isn't included. Never translate account identifiers in form values, passwords, OTP fields, or credit card fields; do not capture typed inputs. A user may opt to translate surrounding static labels locally on /login; the route itself must not be categorically broken, because /login is the motivating use case.
]]></sensitive_sites>
    <logging><![CDATA[
Default logs should report aggregate counts/timings/errors without page text, full visited URLs, credential strings, or personal data. Debug mode must be opt-in and redact by design. No telemetry in MVP unless explicit opt-in, disclosed scope, and robust deletion path are implemented. Never log user API keys.
]]></logging>
    <privacy_docs><![CDATA[
Write a human-readable PRIVACY.md aligned with actual code and third-party provider selection, retention, storage, permissions, legal/contact details awaiting maintainer input, and any cloud processing. Never copy a template asserting facts that are untrue. Generate Chrome privacy-disclosure checklist and Firefox data_collection_permissions checklist for the configured builds. Privacy claims must be tested: create a network inspector test that fails if page text leaves device when cloud permission is off.
]]></privacy_docs>
  </security_privacy_threat_model>
  <performance_budgets><![CDATA[
Set concrete, measurable targets and measure against realistic fixtures; refine after profiling:
- No permanent body/document visibility hiding. Progressive translation of first-viewport content first when appropriate.
- DOM event listener and observer count must remain bounded; avoid a new global observer per route.
- Batch mutations into microtasks/requestIdleCallback or requestAnimationFrame when available; do not block main thread on large pages.
- Aim for less than 50 ms total synchronous work per processing slice in common desktop conditions; break long tasks when thresholds are reached.
- Avoid rewalking the entire document for every small mutation; process affected roots with a dedup queue.
- Cap translated nodes queued and text size per batch; show partial state for huge or infinite pages.
- Translation-provider concurrency and rate limits must be configurable and have unit tests.
- Do not use unbounded Map/Set caches for visited pages. Use WeakMap for DOM metadata and bounded LRU for temporary string reuse.
- Profile 100, 1,000, and 10,000 text-node fixtures; quantify memory/CPU and rendering jank.
- Track cold start, time to first translated visible block, total completion, and errors in local diagnostics without collecting browsing data remotely.
]]></performance_budgets>
  <status_protocol_and_error_handling><![CDATA[
Implement an explicit message protocol rather than scattered strings:
POPUP_GET_CONTEXT, GET_PREFERENCES, SET_TARGET_LANGUAGE, TRANSLATE_ONCE, ENABLE_ORIGIN_RULE, DISABLE_ORIGIN_RULE, PAUSE_TAB, RESUME_TAB, REVERT_PAGE, REQUEST_HOST_ACCESS, VERIFY_HOST_ACCESS, TRANSLATE_BATCH, CANCEL_EPOCH, TRANSLATION_PROGRESS, TRANSLATION_COMPLETED, ENGINE_STATUS, PROVIDER_CONSENT_CHANGED, SETTINGS_CHANGED.

Always return structured success/error values. Provide deterministic error codes for unsupported_url, missing_host_access, unsupported_pair, model_download_failed, provider_offline, provider_timeout, rate_limited, bad_response, consent_required, page_navigation, canceled, storage_failure, and unknown_error. Surface a useful action to the user without exposing sensitive internals. Ensure a stale async response cannot reset a newer state.

For provider failures, preserve original text and allow retry. For partial completion, quantify known eligible segments rather than always declaring 100%. Avoid retry storms caused by reactive site updates, wrong language detector output, or 429 rate limits.
]]></status_protocol_and_error_handling>
  <test_matrix><![CDATA[
Unit tests, integration tests, and browser tests MUST cover:

PERSISTENCE AND DOMAIN RULES
[ ] ES home → /login → /dashboard in full navigation, target EN retained.
[ ] SPA pushState / → /login → /dashboard, EN retained.
[ ] SPA replaceState route change and DOM-only content swap.
[ ] Reload current route, new tab same origin, browser restart after persisted preference.
[ ] https://example.test != https://app.example.test unless explicitly granted.
[ ] http://example.test != https://example.test where permission model distinguishes them.
[ ] example.co.uk handled with a public suffix-aware parser.
[ ] Query and hash changes do not create duplicate rules unnecessarily.
[ ] Pause tab vs pause origin vs delete rule are independent.
[ ] Stored rule with permission removed does NOT claim to be active.
[ ] One-time translation DOES NOT silently create a permanent host permission.
[ ] Target-language change cancels old batches and re-translates from genuine original text.
[ ] Back/forward and BFCache restore preserve correct state.

DOM SAFETY AND QUALITY
[ ] Page links, buttons, routing, click handlers, and focus still work.
[ ] Typed username/password, OTP, textarea, contenteditable, credit card details untouched.
[ ] Code blocks, JSON-LD, hidden content, [translate=no], and protected attributes untouched.
[ ] Nested markup and inline links are preserved.
[ ] aria-label/alt/title/placeholder patching and safe revert work as configured.
[ ] MutationObserver doesn't retranslate its own output forever.
[ ] Framework hydration, live chat list, infinite scroll, modal, and tab switches.
[ ] Promise resolves after node removal; no detached-node patch.
[ ] Revert does not overwrite a framework's newer text.
[ ] RTL, CJK, accents, emojis, interpolation tokens, whitespace, inline language spans.
[ ] 10,000 text nodes without catastrophic blocking/memory growth.
[ ] Open Shadow DOM if supported; unsupported frames communicated honestly.

TRANSLATION ENGINES
[ ] Native API available + model ready.
[ ] Native API downloadable + progress surfaced.
[ ] Unsupported browser/language pair fallback requires explicit cloud consent.
[ ] No provider configured → useful UI, never silently fabricate a translation.
[ ] Offline local success; offline remote gracefully unavailable.
[ ] Remote timeout, 429, 5xx, invalid JSON, missing segments, extra segments, oversized payload.
[ ] Canceled epoch rejects late provider results.
[ ] Cloud request never contains editable user-entered values, cookies, or full document HTML.
[ ] Network monitoring proves zero translation-text egress when cloud is disabled.

SECURITY / CROSS-BROWSER
[ ] Popup action with host permission denial and later re-grant.
[ ] Chrome MV3 service-worker sleep/restart and restored preferences.
[ ] Firefox event-page equivalent lifecycle handling.
[ ] Chrome and Firefox manifest review; gecko id and data collection permission accuracy.
[ ] No remote executable code, dangerously permissive CSP, or bundled secret.
[ ] Unknown/spoofed messages rejected and XSS-like provider text treated as text.
[ ] Private/incognito behavior documented and tested where enabled.
[ ] Keyboard navigation, screen-reader labels, reduced motion, WCAG contrast.
[ ] Manual install artifacts work via documented paths; signed Firefox build when required.

Maintain a machine-readable test report or documented checklist with exact browser versions and unresolved gaps. Do not declare complete cross-browser readiness on the basis of jsdom tests alone.
]]></test_matrix>
  <implementation_milestones>
    <phase_0_discovery><![CDATA[
Deliverable: clear baseline of repo status, supported browsers, legal/privacy dependencies, agreed MVP, architecture diagram, and test fixtures. Define initial provider availability per browser. Track unknowns in DECISIONS.md/ADR; do not substitute speculation for feature probes.
]]></phase_0_discovery>
    <phase_1_vertical_slice><![CDATA[
Deliverable: a working Chrome build that can translate eligible visible Spanish text into English on a test origin, persist an explicit origin rule, and reapply it after /login full reload. Includes rule storage, host permissions, basic popup, engine adapter, real-browser smoke test, and graceful unsupported handling.
]]></phase_1_vertical_slice>
    <phase_2_spa_and_safety><![CDATA[
Deliverable: SPA route persistence, dynamic DOM handling, skip lists, safe reversion, cancellation epochs, language detection, useful errors, and integration/browser tests. No page breakage under fixture stress.
]]></phase_2_spa_and_safety>
    <phase_3_firefox><![CDATA[
Deliverable: Firefox MV3 manifest and runtime compatibility, validated translation provider strategy, consent flow when cloud is used, reliable persistent rules, and Firefox-specific tests. Document any engine limitations explicitly.
]]></phase_3_firefox>
    <phase_4_product_ui><![CDATA[
Deliverable: production-worthy minimal popup/settings, approved mono-white liquid-glass branding, accessibility, saved-site management, intelligent statuses, light/dark compatibility, privacy copy, and localization-ready strings.
]]></phase_4_product_ui>
    <phase_5_release><![CDATA[
Deliverable: store-ready Chrome ZIP, Firefox ZIP + source archive and/or signed XPI via proper process, README, privacy policy, store listing copy, screenshots/assets, versioned releases, GitHub CI, and install/troubleshooting instructions. Sign/publish only with the maintainer's authorized accounts, secrets, and explicit confirmation.
]]></phase_5_release>
  </implementation_milestones>
  <definition_of_done><![CDATA[
A milestone is complete only when:
1. Acceptance behavior is demonstrable in at least one real relevant browser.
2. Unit + integration tests pass, typecheck/lint/build complete, and security/privacy regressions are absent.
3. Chrome/Firefox parity and limitations are recorded accurately, not assumed.
4. Permissions match feature needs and user disclosures.
5. Site language preference persists across route changes, full navigations, refreshes, and restart where the milestone promises that behavior.
6. There is no regression in input safety or framework navigation.
7. User-facing documentation and examples reflect shipped functionality.
8. Developer output names exact checks performed and any unverified items.

The whole product is release-ready only after Phase 5 criteria are satisfied and store approval/signature prerequisites are actually met.
]]></definition_of_done>
  <release_and_distribution><![CDATA[
CHROME WEB STORE
- Build the production Chrome MV3 extension via the locked project build command (typically WXT's build/zip workflow).
- Run manifest permission audit, store policy/privacy checklist, popup screenshots, description, single-purpose explanation, and version check.
- Chrome production direct user installation is generally via Chrome Web Store. GitHub-source manual installation is possible for technically capable users through chrome://extensions → Developer mode → Load unpacked → select the built UNPACKED folder, and is not the equivalent of a signed store distribution or automated updates. Do not claim a GitHub .crx or raw .zip offers seamless consumer installation in ordinary Chrome desktop environments.
- Never embed Chrome Web Store credentials/secrets in commits. Publishing requires explicit maintainer approval.

FIREFOX ADD-ONS / AMO
- Build and verify the Firefox MV3 target separately. Include stable browser_specific_settings.gecko.id, truthful data_collection_permissions, and source-code ZIP when required for review.
- Firefox stable/release channels generally require a Mozilla-signed .xpi, including self-distributed unlisted add-ons. Source-only GitHub ZIP can be loaded temporarily for development via about:debugging → This Firefox → Load Temporary Add-on, but that is not a persistent consumer installation.
- For manual GitHub release delivery, arrange Mozilla unlisted signing and publish the signed .xpi as a release asset, with separate update strategy/documentation. Never advise users to disable signature enforcement as the standard install path.

GITHUB
- Keep a real LICENSE, installation instructions for Chrome unpacked/Firefox temporary and signed release, releases with checksums, security policy, changelog, contributing instructions, and reproducible build steps.
- GitHub Actions must check: install --frozen-lockfile; lint; typecheck; test; Chrome build; Firefox build; web-ext lint; package artifact checks; secret scan; dependency audit or equivalent. Browser E2E checks should run where supported. Reject unexpected widening of host permissions.
- Release workflow creates artifacts automatically but does not publish to stores or sign via external developer credentials without approved secrets and explicit configured release workflow.
- Provide clear versioned downloads for people unable to find the extension in a store, without misrepresenting unsigned artifacts as normal installs.
]]></release_and_distribution>
  <installation_commands_and_operational_docs><![CDATA[
Once repo tooling is created, expose consistent scripts with these intents; do not invent scripts in README if absent:
- pnpm install --frozen-lockfile
- pnpm dev:chrome
- pnpm dev:firefox
- pnpm build:chrome
- pnpm build:firefox
- pnpm zip:chrome
- pnpm zip:firefox
- pnpm test
- pnpm test:e2e:chrome
- pnpm lint
- pnpm typecheck
- pnpm verify:manifests
- pnpm verify:packages

If these wrappers map to WXT, document actual script implementations and output paths rather than assuming defaults. Local build must not require a real production provider key; tests use a deterministic fake provider. Include environment variables in .env.example with safe placeholders and explicit separation of backend-only secrets from publicly bundled extension configuration.
]]></installation_commands_and_operational_docs>
  <non_goals_for_mvp><![CDATA[
- Translating images, video audio, PDFs, canvas/WebGL text, or screenshots.
- Changing server-side localization, auto-switching website accounts/locale cookies, rewriting network responses, bypassing paywalls/auth/CSP, or intercepting password fields.
- Guaranteeing every third-party iframe or closed shadow root is translated.
- Full document structure reconstruction or real-time translation of a text editor user's keystrokes.
- Building a custom language model from scratch, training weights, or promising a cost-free translation backend without a validated provider.
- Universal mobile browser support. Only claim it after a browser-specific development/test track.
- Universal invisible translation with no latency; surface real provider/model limitations.
]]></non_goals_for_mvp>
  <codex_subagent_specialization><![CDATA[
If Codex can delegate to subagents, parallelize only independent scopes with a file ownership plan:
- Architecture agent: browser/API feasibility, permissions, background differences, ADRs.
- Translation agent: engine contracts, batching, detection, local/remote provider tests.
- DOM agent: safe TreeWalker/MutationObserver/epoch, page fixture coverage.
- UI/accessibility agent: popup/options/liquid-glass visual language and keyboard testing.
- Security/privacy agent: threat model, data flow, permission and cloud-consent audit.
- QA/release agent: real-browser E2E, manifest lint, packaging, AMO/Chrome store readiness.

Primary agent owns cross-module interfaces, integration, final testing, review, and documentation. Do not have multiple agents concurrently modify the same files without explicit coordination. Where subagents are unavailable, perform these reviews sequentially; don't claim they ran independently.
]]></codex_subagent_specialization>
  <codex_immediate_start_order><![CDATA[
When Codex first reads this AGENTS.md:
1. Output a brief repository baseline (what exists / what is missing).
2. Create a ranked IMPLEMENTATION_PLAN.md with explicit P0, P1, P2 and acceptance tests.
3. Check browser feature support and choose a realizable Chrome MVP translation provider. Mark Firefox provider setup as a real dependency, not an imaginary native API.
4. Scaffold the WXT TypeScript Chrome/Firefox extension and test harness if absent.
5. Implement persisted origin rules, permission requests, content bootstrapping, and a provider stub exercised in / → /login fixture.
6. Replace the stub in end-to-end flow with a supported real provider, keeping a deterministic test fake for CI.
7. Verify the first working vertical slice in a real Chrome browser and report evidence.
8. Proceed through remaining milestone phases, keeping tests, privacy, and documentation current.

Top priority: Demonstrate “translate once, stay translated at /login” before adding settings complexity, branding effects, or more languages.
]]></codex_immediate_start_order>
  <maintainer_decisions_and_default_assumptions><![CDATA[
- Default remembered scope is exact origin, not all sites and not all subdomains.
- Default engine policy is on-device/local first where verified available.
- Firefox cloud translation must be configured and actively consented to; there is no fabricated default free server.
- Initial locale examples are Spanish source and English target; user-selectable target language remains a primary UX requirement.
- Initial UI style: mono-white liquid glass on forest green with subtle shallow mountain and es/en imagery; no retro styling.
- Initial release license: MIT as a proposal only; if the maintainer has an existing license, preserve it. Do not overwrite LICENSE without authorization.
- Public source may be published to GitHub, but creating repositories, publishing to stores, uploading personal data, signing, or deploying production services requires explicit owner authorization and connected credentials.
- A new user should be able to use a supported on-device provider without creating an account.
]]></maintainer_decisions_and_default_assumptions>
  <source_of_truth_and_review_links><![CDATA[
Use official documentation and verify current requirements at build/release time:
- Chrome Translator API: https://developer.chrome.com/docs/ai/translator-api
- Chrome built-in AI APIs: https://developer.chrome.com/docs/ai/built-in-apis
- Chrome extensions permissions: https://developer.chrome.com/docs/extensions/reference/api/permissions
- Chrome content scripts: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- Chrome extension service worker lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- Chrome Web Store policies: https://developer.chrome.com/docs/webstore/program-policies/policies
- Chrome distribution: https://developer.chrome.com/docs/extensions/how-to/distribute
- Firefox MV3 background model: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background
- Firefox browser_specific_settings: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings
- Firefox navigation events: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webNavigation/onHistoryStateUpdated
- Firefox extension signing: https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/
- Firefox self distribution: https://extensionworkshop.com/documentation/publish/self-distribution/
- WXT cross-browser framework: https://wxt.dev/
- WXT packaging: https://wxt.dev/guide/essentials/publishing

Documentation can become outdated: treat these as entrypoints for fresh verification, not permanent claims of support.
]]></source_of_truth_and_review_links>
  <final_directive><![CDATA[
Build a trustworthy persistent translation extension, not an impressive demo that fails on the next page. Treat uninterrupted site navigation, correctness, permissions, accessibility, real-browser evidence, and truthful data handling as non-negotiable. Do not replace this contract with a vague product description. Keep implementation code legible, deterministic, testable, and store-compliant.
]]></final_directive>
</persistent_translate_agent_contract>
