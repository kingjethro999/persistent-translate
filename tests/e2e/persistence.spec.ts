import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
declare const chrome: typeof import('wxt/browser').browser;

// This substitute exists only in the test harness. The installed production
// package has no dictionary, test mode, alternate provider or page bridge.
async function installNativeDouble(context: BrowserContext) {
  await context.addInitScript(() => {
    if (location.protocol !== 'chrome-extension:') return;
    const dictionary: Record<string, string> = {
      'Hola mundo': 'Hello world',
      'Iniciar sesión': 'Sign in',
      'Panel de control': 'Dashboard',
      'Bienvenido a nuestro sitio': 'Welcome to our site',
      Entrar: 'Log in',
      Panel: 'Dashboard',
      'Nombre de usuario': 'Username',
      Contraseña: 'Password',
      'Mostrar más': 'Show more',
      'Contenido nuevo': 'New content',
    };
    Object.defineProperty(globalThis, 'Translator', {
      configurable: true,
      value: {
        availability: async () => 'available',
        create: async () => ({
          translate: async (text: string) => dictionary[text] ?? text,
          destroy: () => {},
        }),
      },
    });
  });
}
async function command(page: Page, message: object) {
  return page.evaluate(async (msg) => {
    const api = (
      globalThis as unknown as {
        chrome: {
          runtime: {
            sendMessage: (
              m: unknown,
            ) => Promise<{ ok: boolean; value?: unknown; error?: string }>;
          };
        };
      }
    ).chrome;
    return api.runtime.sendMessage(msg);
  }, message);
}

test('remembered translation survives /login, reload, new tab and browser restart safely', async () => {
  const profile = await mkdtemp(resolve(tmpdir(), 'persistent-translate-'));
  const extension = resolve('.output/chrome-mv3');
  const launch = () =>
    chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
  let context = await launch();
  try {
    await installNativeDouble(context);
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    const network: string[] = [];
    context.on('request', (request) => {
      if (request.url().startsWith('http')) network.push(request.url());
    });
    const engine = await context.newPage();
    await engine.goto(
      `chrome-extension://${id}/engine.html?source=es&target=en`,
    );
    await engine
      .getByRole('button', { name: /Prepare language model/i })
      .click();
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/');
    const tabId = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tabs[0]!.id!;
    });
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    // The real permission API is invoked by a trusted extension-page click.
    await popup.evaluate(() => {
      const button = document.createElement('button');
      button.id = 'test-grant';
      button.textContent = 'Grant test origin';
      button.onclick = () => {
        void chrome.permissions
          .request({ origins: ['http://127.0.0.1/*'] })
          .then((ok) => {
            button.dataset.granted = String(ok);
          });
      };
      document.body.append(button);
    });
    await popup.locator('#test-grant').click();
    await expect(popup.locator('#test-grant')).toHaveAttribute(
      'data-granted',
      'true',
    );
    expect(
      await command(popup, {
        type: 'ENABLE_ORIGIN_RULE',
        tabId,
        source: 'es',
        target: 'en',
      }),
    ).toMatchObject({ ok: true });
    await expect(page.locator('h1')).toHaveText('Hello world');
    await page.locator('#user').fill('new-user');
    await page.locator('#password').fill('typed-password');
    await expect(page.locator('#user')).toHaveValue('new-user');
    await expect(page.locator('#password')).toHaveValue('typed-password');
    await expect(page.locator('textarea')).toHaveValue('Texto privado');
    await expect(page.locator('[contenteditable]')).toHaveText(
      'Texto editable',
    );
    await expect(page.locator('pre')).toHaveText('const secreto = 1;');
    await expect(page.locator('[translate=no]')).toHaveText('No traducir');
    await page.locator('#dynamic').click();
    await expect(page.locator('#added')).toHaveText('New content');
    expect(await command(popup, { type: 'PAUSE_TAB', tabId })).toMatchObject({
      ok: true,
    });
    await expect(page.locator('h1')).toHaveText('Hola mundo');
    const cdp = await context.newCDPSession(popup);
    await cdp.send('ServiceWorker.stopAllWorkers');
    await cdp.detach();
    expect(await command(popup, { type: 'GET_PREFERENCES' })).toMatchObject({
      ok: true,
    });
    await engine
      .getByRole('button', { name: /Prepare language model/i })
      .click();
    // A model-ready notification after worker recreation must honor tab pause.
    await expect(page.locator('h1')).toHaveText('Hola mundo');
    expect(await command(popup, { type: 'RESUME_TAB', tabId })).toMatchObject({
      ok: true,
    });
    await expect(page.locator('h1')).toHaveText('Hello world');
    expect(
      await command(popup, {
        type: 'TRANSLATE_ONCE',
        tabId,
        source: 'es',
        target: 'en',
      }),
    ).toMatchObject({ ok: true });
    expect(
      await command(popup, {
        type: 'DISABLE_ORIGIN_RULE',
        origin: 'http://127.0.0.1:4173',
      }),
    ).toMatchObject({ ok: true });
    await expect(page.locator('h1')).toHaveText('Hola mundo');
    // A later explicit page-only action can override the disabled saved rule.
    expect(
      await command(popup, {
        type: 'TRANSLATE_ONCE',
        tabId,
        source: 'es',
        target: 'en',
      }),
    ).toMatchObject({ ok: true });
    await expect(page.locator('h1')).toHaveText('Hello world');
    const cdpOnce = await context.newCDPSession(popup);
    await cdpOnce.send('ServiceWorker.stopAllWorkers');
    await cdpOnce.detach();
    await page.evaluate(() => {
      const p = document.createElement('p');
      p.id = 'after-worker';
      p.textContent = 'Contenido nuevo';
      document.body.append(p);
    });
    await expect(page.locator('#after-worker')).toHaveText('New content');
    expect(
      await command(popup, {
        type: 'ENABLE_ORIGIN_RULE',
        tabId,
        source: 'es',
        target: 'en',
      }),
    ).toMatchObject({ ok: true });
    await page.locator('#login').click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('h1')).toHaveText('Sign in');
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Sign in');
    const second = await context.newPage();
    await second.goto('http://127.0.0.1:4173/dashboard');
    await expect(second.locator('h1')).toHaveText('Dashboard');
    expect(
      network.every((url) => new URL(url).origin === 'http://127.0.0.1:4173'),
    ).toBe(true);
    // The profile includes the real browser permission grant and durable rule.
    await context.close();
    context = await launch();
    await installNativeDouble(context);
    const engine2 = await context.newPage();
    await engine2.goto(
      `chrome-extension://${id}/engine.html?source=es&target=en`,
    );
    await engine2
      .getByRole('button', { name: /Prepare language model/i })
      .click();
    const restored = await context.newPage();
    await restored.goto('http://127.0.0.1:4173/login');
    await expect(restored.locator('h1')).toHaveText('Sign in');
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${id}/popup.html`);
    await popup2.evaluate(() =>
      chrome.permissions.remove({ origins: ['http://127.0.0.1/*'] }),
    );
    await expect(restored.locator('h1')).toHaveText('Iniciar sesión');
    await restored.reload();
    await expect(restored.locator('h1')).toHaveText('Iniciar sesión');
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('production engine reports unavailable without fabricating translation', async () => {
  const extension = resolve('.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const page = await context.newPage();
    await page.addInitScript(() =>
      Object.defineProperty(globalThis, 'Translator', {
        value: undefined,
        configurable: true,
      }),
    );
    await page.goto(
      `chrome-extension://${new URL(worker.url()).host}/engine.html`,
    );
    await page.getByRole('button', { name: /Prepare language model/i }).click();
    await expect(page.getByRole('status')).toContainText(
      /unavailable|not available|not supported/i,
    );
  } finally {
    await context.close();
  }
});
