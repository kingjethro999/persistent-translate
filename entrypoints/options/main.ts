import { browser } from 'wxt/browser';
import { record } from '../../src/core/messaging/protocol';
import '../../src/ui.css';
const status = document.getElementById('status')!;
async function send(message: object) {
  const response: unknown = await browser.runtime.sendMessage(message);
  if (!record(response) || !response.ok) throw new Error('storage_failure');
  return response.value;
}
async function render() {
  const preferences = await send({ type: 'GET_PREFERENCES' });
  if (!record(preferences) || !record(preferences.perOriginRules))
    throw new Error('storage_failure');
  const root = document.getElementById('rules')!;
  root.replaceChildren();
  const rules = Object.values(preferences.perOriginRules);
  if (!rules.length) {
    const empty = document.createElement('p');
    empty.textContent =
      'No saved websites. Open the popup on a website to remember its language.';
    root.append(empty);
  }
  for (const rule of rules) {
    if (!record(rule) || typeof rule.key !== 'string') continue;
    const origin = rule.key;
    const row = document.createElement('div');
    row.className = 'rule';
    const text = document.createElement('p');
    text.textContent = `${origin} → ${String(rule.targetLanguage)} · ${rule.enabled ? 'Enabled' : 'Paused'}`;
    const grants = Array.isArray(preferences.access) ? preferences.access : [];
    if (
      !grants.some(
        (grant) => record(grant) && grant.origin === origin && grant.granted,
      )
    )
      text.textContent += ' · Permission needed';
    row.append(text);
    for (const [label, type] of [
      ['Pause site', 'DISABLE_ORIGIN_RULE'],
      ['Remove choice', 'REMOVE_ORIGIN_RULE'],
    ]) {
      const button = document.createElement('button');
      button.className = 'secondary';
      button.textContent = label!;
      button.onclick = () => {
        button.disabled = true;
        void send({ type, origin })
          .then(() => render())
          .catch(() => {
            status.textContent = 'Unable to update the saved rule.';
            button.disabled = false;
          });
      };
      row.append(button);
    }
    root.append(row);
  }
}
void render().catch(() => {
  status.textContent =
    'Unable to read saved rules. The stored data was left unchanged.';
});
