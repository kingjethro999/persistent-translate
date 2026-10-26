# Persistent Translate product requirements

Revision: 2026-10-25. Promise: **Translate once; stay translated across a website.**

## Problem and user outcome

A person reading an unfamiliar language should not repeat a translation action after opening a website's next page. Their choice must survive a new document because the extension remembers the choice and runs another pass. The website itself is not permanently rewritten.

The first user journey is Spanish homepage → English target → **Always translate this site** → browser access approval → translated homepage → translated `/login`. Static sign-in labels may be translated locally while typed credentials and form behavior remain untouched. A user can pause or remove the saved choice and return to original text safely.

## Phase 1 experience

- A compact, keyboard-operable popup identifies the current origin, source/target pair and state. The default target follows the user's locale when valid, rather than assuming English universally.
- Persistence requires an explicit action and the browser's website grant. A one-time action remains temporary.
- A visible engine setup page explains local model readiness and reports download progress. No account or vendor key is required for a supported native pair.
- Settings expose saved origins and their enabled state. Inactive access or an unavailable engine must not be presented as successful translation.
- Settings/privacy remain accessible without covering the visited page with an unsolicited modal.

## Product boundaries

Only exact origins and top-frame text are covered initially. Browser stores and privileged pages are unsupported. Related subdomains, automatic language detection, production branding, attribute/Shadow DOM/frame coverage, complete SPA coverage and a Firefox translation provider are later phases. Images, PDFs, audio, canvas, editor keystrokes, website accounts and server-side localization are outside the MVP.

Local processing is the only shipped provider path in this slice. A future remote provider requires a concrete operator, privacy disclosure, affirmative consent and compatible Firefox declarations before text can leave the device. There is no implicit hosted service.

## Success measures and release gate

Use reproducible fixtures, never browsing telemetry: the second document translates without another popup action; typed fields and existing handlers retain their values/behavior; denied access produces an accurate state; stale work never overwrites newer site content; page text does not enter network requests or persistent storage.

The primary success measure remains open until a real Chrome language model demonstrates `/` → `/login`. A fake-backed browser test proves lifecycle wiring, not native translation quality. Firefox packaging is not Firefox product parity. Production release additionally needs the wider test matrix, signed/store distribution, approved artwork and a published maintainer contact. See [TEST_PLAN.md](TEST_PLAN.md) and [DECISIONS.md](DECISIONS.md).
