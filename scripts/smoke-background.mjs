import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const firefox = process.argv.includes('--firefox');
const bundle = fileURLToPath(new URL(firefox ? '../dist-firefox/background.js' : '../dist/background.js', import.meta.url));

if (!existsSync(bundle)) {
  console.error(`[smoke:background] ${bundle} not found - run "npm run build" first.`);
  process.exit(1);
}

const code = readFileSync(bundle, 'utf8');

// A module service worker has `this === undefined` at top level; classic workers
// and content scripts get the global. Attaching exports to `this` breaks the
// former with "Service worker registration failed. Status code: 15".
const tail = code.slice(-400);
if (/\)\(this\.[A-Za-z_$]/.test(tail)) {
  console.error('[smoke:background] bundle attaches its exports to top-level `this`, which throws in a module service worker.');
  process.exit(1);
}

const event = () => ({ addListener() {}, removeListener() {}, hasListener: () => false });

const chromeStub = {
  runtime: {
    onMessage: event(),
    onInstalled: event(),
    onStartup: event(),
    onSuspend: event(),
    getManifest: () => ({ version: '1.0.0' }),
    getURL: (path) => `chrome-extension://smoke/${path}`,
    sendMessage: () => Promise.resolve(),
    lastError: undefined,
  },
  storage: {
    local: {
      get: (_keys, callback) => callback?.({ 'jobpal.version': '1.0.0' }),
      set: (_items, callback) => callback?.(),
      remove: (_keys, callback) => callback?.(),
    },
    onChanged: event(),
  },
  tabs: {
    query: (_query, callback) => callback?.([{ id: 1, url: 'https://example.com/job/1' }]),
    create: (_props, callback) => callback?.({ id: 1 }),
    get: (_id, callback) => callback?.({ id: 1, status: 'complete' }),
    update: () => Promise.resolve(),
    sendMessage: (_id, _message, callback) => callback?.(undefined),
    remove: () => Promise.resolve(),
    reload: (_id, _props, callback) => callback?.(),
    onUpdated: event(),
    onRemoved: event(),
  },
  alarms: { onAlarm: event(), create: () => Promise.resolve(), clear: () => Promise.resolve() },
  notifications: { onClicked: event(), create: (_id, _options, callback) => callback?.(_id), clear: (_id, callback) => callback?.(true) },
  contextMenus: { removeAll: (callback) => callback?.(), create() {}, onClicked: event() },
  sidePanel: { setPanelBehavior: () => Promise.resolve(), open: () => Promise.resolve() },
  offscreen: { hasDocument: () => Promise.resolve(false), createDocument: () => Promise.resolve() },
  downloads: { download: (_options, callback) => callback?.(1) },
  identity: { launchWebAuthFlow: () => Promise.resolve(''), getRedirectURL: () => 'https://smoke.chromiumapp.org/' },
  scripting: { executeScript: () => Promise.resolve([]) },
  windows: { update: () => Promise.resolve(), create: () => Promise.resolve() },
  action: {},
  i18n: { getMessage: (key) => key },
};

// An IndexedDB stub whose requests never settle: keeps bootstrap() pending
// (exactly like a slow service worker) without producing unhandled rejections.
const indexedDbStub = {
  open() {
    return { onsuccess: null, onerror: null, onupgradeneeded: null, result: null };
  },
};

try {
  globalThis.chrome = chromeStub;
  globalThis.indexedDB = indexedDbStub;
  const evaluate = new Function(`"use strict";\n${code}\n//# sourceURL=jobpal-background-smoke.js`);
  evaluate.call(undefined);
} catch (error) {
  console.error('[smoke:background] bundle threw during evaluation:');
  console.error(error);
  process.exit(1);
}

await new Promise((resolve) => setTimeout(resolve, 50));
console.log(`[smoke:background] ${firefox ? 'firefox' : 'chrome'} background bundle evaluates cleanly`);
console.log('BACKGROUND SMOKE TEST PASSED');
