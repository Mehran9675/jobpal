import { storageLocalGet, storageLocalSet } from './browser';
import { DEFAULT_SETTINGS, LEGACY_FILENAME_PATTERN, deepMerge } from './defaults';
import { emptyProfile } from '@/types';
import type { AppSettings, BaseResume, Profile } from '@/types';
import { uid } from './utils';

const KEYS = {
  settings: 'jobpal.settings',
  profiles: 'jobpal.profiles',
  resumes: 'jobpal.resumes',
  initialized: 'jobpal.initialized',
} as const;

function migrateSettings(settings: AppSettings): AppSettings {
  // Files must never carry the company or role in their name.
  if (settings.document.fileNamePattern === LEGACY_FILENAME_PATTERN) {
    settings.document.fileNamePattern = DEFAULT_SETTINGS.document.fileNamePattern;
  }
  return settings;
}

export async function getSettings(): Promise<AppSettings> {
  const items = await storageLocalGet<AppSettings>([KEYS.settings]);
  const stored = items[KEYS.settings];
  if (!stored) return structuredClone(DEFAULT_SETTINGS);
  return migrateSettings(deepMerge(structuredClone(DEFAULT_SETTINGS), stored));
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const merged = migrateSettings(deepMerge(structuredClone(DEFAULT_SETTINGS), settings));
  await storageLocalSet({ [KEYS.settings]: merged });
  return merged;
}

export async function patchSettings(patch: Record<string, unknown>): Promise<AppSettings> {
  const current = await getSettings();
  const next = migrateSettings(deepMerge(current, patch));
  await storageLocalSet({ [KEYS.settings]: next });
  return next;
}

export async function getProfiles(): Promise<Profile[]> {
  const items = await storageLocalGet<Profile[]>([KEYS.profiles]);
  const list = items[KEYS.profiles] ?? [];
  if (list.length === 0) {
    const profile = emptyProfile(uid('profile'), 'Primary');
    await storageLocalSet({ [KEYS.profiles]: [profile], [KEYS.initialized]: true });
    return [profile];
  }
  return list;
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const list = await getProfiles();
  let next = list.map((item) => (item.id === profile.id ? profile : item));
  if (profile.isDefault) next = next.map((item) => (item.id === profile.id ? item : { ...item, isDefault: false }));
  if (!next.some((item) => item.id === profile.id)) next = [...next, profile];
  if (!next.some((item) => item.isDefault) && next.length > 0) next[0] = { ...next[0], isDefault: true };
  await storageLocalSet({ [KEYS.profiles]: next });
  return profile;
}

export async function deleteProfile(id: string): Promise<void> {
  const list = await getProfiles();
  let next = list.filter((item) => item.id !== id);
  if (next.length === 0) next = [emptyProfile(uid('profile'), 'Primary')];
  if (!next.some((item) => item.isDefault)) next[0] = { ...next[0], isDefault: true };
  await storageLocalSet({ [KEYS.profiles]: next });
}

export async function getDefaultProfile(): Promise<Profile> {
  const list = await getProfiles();
  return list.find((item) => item.isDefault) ?? list[0];
}

export async function getResumes(): Promise<BaseResume[]> {
  const items = await storageLocalGet<BaseResume[]>([KEYS.resumes]);
  return items[KEYS.resumes] ?? [];
}

export async function saveResume(resume: BaseResume): Promise<BaseResume> {
  const list = await getResumes();
  const exists = list.some((item) => item.id === resume.id);
  const next = exists ? list.map((item) => (item.id === resume.id ? resume : item)) : [...list, resume];
  await storageLocalSet({ [KEYS.resumes]: next });
  return resume;
}

export async function deleteResume(id: string): Promise<void> {
  const list = await getResumes();
  await storageLocalSet({ [KEYS.resumes]: list.filter((item) => item.id !== id) });
}

export function settingsStorageKey(): string {
  return KEYS.settings;
}

export function watchStorage(callback: (changes: Record<string, chrome.storage.StorageChange>) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local') callback(changes);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
