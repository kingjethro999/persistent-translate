import { defineConfig } from 'wxt';

export default defineConfig({
  imports: false,
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'Persistent Translate',
    description:
      'Translate webpages seamlessly. Remember translation choices for each website.',
    permissions: ['storage', 'activeTab', 'scripting'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    ...(browser === 'chrome' ? { minimum_chrome_version: '138' } : {}),
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko_android: { strict_min_version: '142.0' },
            gecko: {
              id: 'persistent-translate@kingjethro999.github.io',
              strict_min_version: '140.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
