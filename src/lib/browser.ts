export const isFirefox = typeof (globalThis as { browser?: unknown }).browser !== 'undefined';

interface BrowserLike {
  runtime: typeof chrome.runtime;
  storage: typeof chrome.storage;
  tabs: typeof chrome.tabs;
  scripting: typeof chrome.scripting;
  alarms: typeof chrome.alarms;
  notifications?: typeof chrome.notifications;
  contextMenus?: typeof chrome.contextMenus;
  downloads?: typeof chrome.downloads;
  identity?: typeof chrome.identity;
  action?: typeof chrome.action;
  sidePanel?: typeof chrome.sidePanel;
  offscreen?: typeof chrome.offscreen;
  windows?: typeof chrome.windows;
}

const g = globalThis as unknown as { browser?: BrowserLike; chrome?: BrowserLike };

export const api: BrowserLike = (g.browser ?? g.chrome) as BrowserLike;

export const runtime = api.runtime;
export const storageApi = api.storage;

export function lastError(): string | null {
  try {
    return chrome.runtime.lastError?.message ?? null;
  } catch {
    return null;
  }
}

export function tabsQuery(query: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve) => {
    chrome.tabs.query(query, (tabs) => {
      void lastError();
      resolve(tabs ?? []);
    });
  });
}

export function tabsCreate(props: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(props, (tab) => {
      const err = lastError();
      if (err) reject(new Error(err));
      else resolve(tab);
    });
  });
}

export function tabsReload(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.reload(tabId, {}, () => {
      void lastError();
      resolve();
    });
  });
}

export function tabSendMessage<T>(tabId: number, message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response: T) => {
      const err = lastError();
      if (err) reject(new Error(err));
      else resolve(response);
    });
  });
}

export function storageLocalGet<T>(keys: string | string[] | null): Promise<Record<string, T>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys as string | string[] | null, (items) => {
      void lastError();
      resolve((items ?? {}) as Record<string, T>);
    });
  });
}

export function storageLocalSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => {
      void lastError();
      resolve();
    });
  });
}

export function storageLocalRemove(keys: string | string[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => {
      void lastError();
      resolve();
    });
  });
}

export function notificationsCreate(options: chrome.notifications.NotificationOptions<true>, id?: string): Promise<string> {
  return new Promise((resolve) => {
    if (!chrome.notifications) {
      resolve('');
      return;
    }
    chrome.notifications.create(id ?? `jobpaal-${Date.now()}`, options, (createdId) => {
      void lastError();
      resolve(createdId ?? '');
    });
  });
}

export async function openOptionsPage(hash?: string): Promise<void> {
  const url = chrome.runtime.getURL(`options.html${hash ? `#${hash}` : ''}`);
  const tabs = await tabsQuery({ url: chrome.runtime.getURL('options.html*') });
  if (tabs.length > 0 && tabs[0].id !== undefined) {
    await chrome.tabs.update(tabs[0].id, { active: true, url });
    if (tabs[0].windowId !== undefined) {
      await chrome.windows?.update(tabs[0].windowId, { focused: true });
    }
  } else {
    await tabsCreate({ url });
  }
}
