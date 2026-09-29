import type { Plugin } from 'vite';

export interface ManifestVariant {
  target: 'chrome' | 'firefox';
  overrides?: Record<string, unknown>;
}

export function getManifest(target: 'chrome' | 'firefox') {
  const isFirefox = target === 'firefox';

  const base: Record<string, unknown> = {
    manifest_version: 3,
    name: '__MSG_extName__',
    short_name: 'JobPal',
    description: '__MSG_extDescription__',
    version: '1.0.32',
    default_locale: 'en',
    minimum_chrome_version: isFirefox ? undefined : '116',
    icons: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    action: {
      default_title: 'JobPal',
      default_popup: 'popup.html',
      default_icon: {
        16: 'icons/icon16.png',
        32: 'icons/icon32.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png',
      },
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    background: isFirefox
      ? { scripts: ['background.js'] }
      : { service_worker: 'background.js' },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.js'],
        run_at: 'document_idle',
        // Runs in every frame so the picker can select fields inside iframes.
        all_frames: true,
      },
    ],
    permissions: [
      'storage',
      'unlimitedStorage',
      'activeTab',
      'scripting',
      'tabs',
      'alarms',
      'notifications',
      'contextMenus',
      'downloads',
      'identity',
      'clipboardRead',
      ...(isFirefox ? [] : ['offscreen', 'sidePanel']),
    ],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['assets/*', 'icons/*', 'offscreen.html', 'viewer.html'],
        matches: ['<all_urls>'],
      },
    ],
  };

  if (isFirefox) {
    delete base.minimum_chrome_version;
    base.sidebar_action = {
      default_title: 'JobPal',
      default_icon: { 16: 'icons/icon16.png', 32: 'icons/icon32.png' },
      default_panel: 'sidepanel.html',
    };
    base.browser_specific_settings = {
      gecko: {
        id: 'jobpal@jobpal.app',
        strict_min_version: '121.0',
      },
    };
  } else {
    base.side_panel = {
      default_path: 'sidepanel.html',
    };
  }

  return base;
}

export function manifestPlugin(target: 'chrome' | 'firefox'): Plugin {
  let outDir = 'dist';
  return {
    name: 'jobpal-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(getManifest(target), null, 2),
      });
      void outDir;
    },
  };
}
