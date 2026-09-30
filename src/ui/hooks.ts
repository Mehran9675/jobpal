import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppSettings, ApplicationRecord, DocumentRecord, ID, PageContext, Profile } from '@/types';
import { sendMessage, sendTabMessage, errorMessage } from '@/lib/messaging';
import { tabsQuery } from '@/lib/browser';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[] = [], initial?: T) {
  const [data, setData] = useState<T | undefined>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    try {
      setError(null);
      const result = await loaderRef.current();
      setData(result);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload, setData };
}

export function useSettings() {
  const { data, loading, reload, setData } = useAsyncData<AppSettings>(() => sendMessage('settings.get', undefined), [], DEFAULT_SETTINGS);

  const patch = useCallback(
    async (patchValue: Record<string, unknown>) => {
      const next = await sendMessage('settings.patch', { patch: patchValue });
      setData(next);
      return next;
    },
    [setData],
  );

  return { settings: data ?? DEFAULT_SETTINGS, loading, patch, reload };
}

export function useProfiles() {
  const { data, loading, reload, setData } = useAsyncData<Profile[]>(() => sendMessage('profile.list', undefined), [], []);

  const save = useCallback(
    async (profile: Profile) => {
      const saved = await sendMessage('profile.save', { profile });
      await reload();
      return saved;
    },
    [reload],
  );

  const remove = useCallback(
    async (id: ID) => {
      await sendMessage('profile.delete', { id });
      await reload();
    },
    [reload],
  );

  return { profiles: data ?? [], loading, save, remove, reload, setData };
}

export function useApplications() {
  const { data, loading, reload, setData } = useAsyncData<ApplicationRecord[]>(() => sendMessage('applications.list', undefined), [], []);

  const update = useCallback(
    async (id: ID, patch: Partial<ApplicationRecord> & { statusNote?: string }) => {
      const updated = await sendMessage('applications.update', { id, patch });
      setData((current) => (current ?? []).map((item) => (item.id === id ? updated : item)));
      return updated;
    },
    [setData],
  );

  const remove = useCallback(
    async (id: ID) => {
      await sendMessage('applications.delete', { id });
      setData((current) => (current ?? []).filter((item) => item.id !== id));
    },
    [setData],
  );

  return { applications: data ?? [], loading, update, remove, reload };
}

export function useDocuments(applicationId?: ID) {
  return useAsyncData<DocumentRecord[]>(() => sendMessage('documents.list', applicationId ? { applicationId } : undefined), [applicationId], []);
}

export function usePageContext(pollMs = 3000) {
  const [context, setContext] = useState<PageContext | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const tabs = await tabsQuery({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
        setContext(null);
        setTabId(null);
        return;
      }
      setTabId(tab.id);
      const result = await sendTabMessage(tab.id, 'page.getContext', undefined, { timeout: 8000 });
      setContext(result);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
      setContext(null);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), pollMs);
    return () => clearInterval(interval);
  }, [load, pollMs]);

  return { context, tabId, error, reload: load };
}

export function useRuntimeEvents(handler: (name: string, data: unknown) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const listener = (message: { type?: string; name?: string; data?: unknown }) => {
      if (message?.type === 'jobpal:event' && typeof message.name === 'string') {
        handlerRef.current(message.name, message.data);
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);
}

export function useTheme(settings: AppSettings | undefined) {
  useEffect(() => {
    const ui = settings?.ui ?? DEFAULT_SETTINGS.ui;
    const root = document.documentElement;
    const apply = () => {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      const theme = ui.theme === 'system' ? (prefersLight ? 'light' : 'dark') : ui.theme;
      root.setAttribute('data-theme', theme);
    };
    apply();
    root.style.setProperty('--accent', ui.accent);
    root.style.setProperty('--accent-soft', `${ui.accent}38`);
    const listener = () => apply();
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', listener);
    return () => window.matchMedia('(prefers-color-scheme: light)').removeEventListener('change', listener);
  }, [settings?.ui.theme, settings?.ui.accent]);
}

export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T>(task: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await task();
    } catch (caught) {
      setError(errorMessage(caught));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, setError };
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback(async (text: string, tag = 'default') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }, []);
  return { copied, copy };
}

export function useFilteredApplications(applications: ApplicationRecord[]) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return applications.filter((application) => {
      if (status !== 'all' && application.status !== status) return false;
      if (!needle) return true;
      return `${application.jobTitle} ${application.company} ${application.notes}`.toLowerCase().includes(needle);
    });
  }, [applications, query, status]);
  return { query, setQuery, status, setStatus, filtered };
}
