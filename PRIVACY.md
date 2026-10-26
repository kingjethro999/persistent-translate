# Privacy notice — development version

Effective revision: 2026-10-25. This notice covers the source and browser builds in this repository. It does not describe an approved store release or a future remote provider.

## What the extension processes

When you enable translation, the isolated content script reads eligible visible text in the top-level document. It sends small text batches through internal extension messages to a local native-engine document. Chrome's on-device Translator processes those strings. The extension replaces exact text nodes without uploading HTML or rebuilding the page.

Inputs and editable descendants, including password fields, typed form values, textarea content and contenteditable regions, are excluded. Scripts, code, explicit nontranslation regions and hidden content are skipped. Static labels on a sign-in page may be translated locally. Visible website text can still contain private information: exclusion rules cannot establish an absolute guarantee that every sensitive string is recognized. You can disable translation for an origin or remove the extension's access in browser settings.

## Stored information and retention

Extension-local browser storage contains the default target, exact-origin source/target rules, enabled state, update times and schema version. An origin contains scheme, hostname and any nondefault port; it excludes the page path, query and fragment. The browser separately stores your website permission grants. These settings reveal which origins you chose and should be treated as private configuration.

Source strings, translations and original-node metadata are temporary runtime data. They are not written to extension storage, sync storage, URLs, persistent diagnostic logs or crash reports by this implementation. There is no persistent translation cache, browsing-history collection, advertising identifier, telemetry, account database or maintainer-operated translation server. Closing documents/releases of runtime references clears their temporary state; Chrome manages its own model lifetime and files.

You can delete saved rules in settings and revoke host grants in the browser's extension settings. Disabling a rule preserves its language choice; removing it deletes that saved choice. Uninstalling removes the extension's local settings according to browser behavior. Removing a rule is not represented as revoking every browser permission automatically unless the UI explicitly performs that operation.

## Network and third parties

This phase implements no cloud translation and no remote text fallback. The extension does not send page text to its maintainer, a translation endpoint or an analytics service. Native engine setup may cause Chrome to download model components over the network; model downloads are browser-controlled activity and are distinct from extension page-text uploads. Normal network requests made by the website and the browser itself are outside this extension's control.

Runtime tests inspect extension-origin requests for text egress. This is scoped evidence for the tested flow, not an audit of all browser internals. See [TEST_PLAN.md](TEST_PLAN.md) for what was actually verified.

Firefox has no configured translation provider in this phase. A future remote engine must identify the actual operator, destination, transmitted fields, known retention/location terms and revoke flow, and obtain affirmative consent before sending text. No such future consent is pre-granted by installing this version.

## Permissions inventory

| Permission                                        | Use                                                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                         | Persist language preferences and site rules locally                                                                          |
| `activeTab`                                       | Access the user-invoked current page for a temporary one-time action/context                                                 |
| `scripting`                                       | Inject/register the bundled isolated content script for authorized pages                                                     |
| Optional `http://*/*`, `https://*/*` declarations | Permit a later user-initiated grant for a selected host; these declarations are not universal access granted at installation |

The extension requests a specific host after an intentional persistence action. The runtime rule additionally checks exact origin even where browser access covers more ports. No cookie, browsing-history, debugger, clipboard, download or native messaging permission is requested. Frames, file URLs, browser-internal pages and extension stores are not covered. Incognito/private browsing is not an advertised or verified feature; leave browser private-access disabled for this development version.

## Store disclosure review

- Chrome: describe the single translation purpose, local reading of website content, origin settings, optional host access and native model download. Do not claim remote website-content collection or telemetry that this build does not implement. Reconcile the current store form with the actual build before submission.
- Firefox: the current manifest declares `data_collection_permissions.required: ["none"]`, because this version does not collect/transmit user data outside the device. Adding cloud translation requires a fresh declaration review, including `websiteContent`, and product/browser consent. [Mozilla's manifest guidance](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings) defines these fields.
- Both: build/permission checks and this notice must change together whenever data flow or permissions change. No store submission has been asserted.

## Contact

The maintainer's legal identity and dedicated privacy contact are not yet supplied. Before a public store release, the maintainer must add an appropriate contact. For non-sensitive development questions, use the repository's issue tracker. Do not post private page text, credentials or personal browsing information in a public issue. Security reporting guidance is in [SECURITY.md](SECURITY.md).
