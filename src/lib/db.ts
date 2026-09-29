import { uid } from './utils';
import type {
  ApplicationRecord,
  DocumentRecord,
  ID,
  JobRecord,
  StoredApplicationEvent,
} from '@/types';

const DB_NAME = 'jobpal';
const DB_VERSION = 1;

type StoreName = 'documents' | 'jobs' | 'applications' | 'events';

const STORES: Record<StoreName, { keyPath: string; indexes: { name: string; keyPath: string | string[]; unique?: boolean }[] }> = {
  documents: {
    keyPath: 'id',
    indexes: [
      { name: 'applicationId', keyPath: 'applicationId' },
      { name: 'jobId', keyPath: 'jobId' },
      { name: 'createdAt', keyPath: 'createdAt' },
      { name: 'kind', keyPath: 'kind' },
    ],
  },
  jobs: {
    keyPath: 'id',
    indexes: [
      { name: 'canonicalUrl', keyPath: 'canonicalUrl' },
      { name: 'company', keyPath: 'company' },
      { name: 'scrapedAt', keyPath: 'scrapedAt' },
    ],
  },
  applications: {
    keyPath: 'id',
    indexes: [
      { name: 'jobId', keyPath: 'jobId' },
      { name: 'status', keyPath: 'status' },
      { name: 'updatedAt', keyPath: 'updatedAt' },
      { name: 'company', keyPath: 'company' },
    ],
  },
  events: {
    keyPath: 'id',
    indexes: [
      { name: 'at', keyPath: 'at' },
      { name: 'applicationId', keyPath: 'applicationId' },
    ],
  },
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, def] of Object.entries(STORES) as [StoreName, (typeof STORES)[StoreName]][]) {
        const store = db.objectStoreNames.contains(name)
          ? request.transaction!.objectStore(name)
          : db.createObjectStore(name, { keyPath: def.keyPath });
        for (const index of def.indexes) {
          if (!store.indexNames.contains(index.name)) {
            store.createIndex(index.name, index.keyPath, { unique: index.unique ?? false });
          }
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
  });
  return dbPromise;
}

function tx<T>(storeName: StoreName, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const request = run(transaction.objectStore(storeName));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error(`IndexedDB ${mode} failed on ${storeName}`));
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
      }),
  );
}

export function idbGet<T>(store: StoreName, key: ID): Promise<T | undefined> {
  return tx<T | undefined>(store, 'readonly', (s) => s.get(key));
}

export function idbGetAll<T>(store: StoreName): Promise<T[]> {
  return tx<T[]>(store, 'readonly', (s) => s.getAll());
}

export function idbGetAllByIndex<T>(store: StoreName, index: string, value: ID): Promise<T[]> {
  return tx<T[]>(store, 'readonly', (s) => s.index(index).getAll(value));
}

export function idbPut<T>(store: StoreName, value: T): Promise<T> {
  return tx<T>(store, 'readwrite', (s) => s.put(value as unknown as never) as unknown as IDBRequest<T>);
}

export function idbDelete(store: StoreName, key: ID): Promise<void> {
  return tx<undefined>(store, 'readwrite', (s) => s.delete(key) as IDBRequest<undefined>).then(() => undefined);
}

export function idbClear(store: StoreName): Promise<void> {
  return tx<undefined>(store, 'readwrite', (s) => s.clear() as IDBRequest<undefined>).then(() => undefined);
}

/* ----------------------------- Jobs ------------------------------- */

export async function findJobByUrl(canonicalUrl: string): Promise<JobRecord | undefined> {
  const matches = await idbGetAllByIndex<JobRecord>('jobs', 'canonicalUrl', canonicalUrl);
  return matches[0];
}

export async function saveJob(job: JobRecord): Promise<JobRecord> {
  await idbPut('jobs', job);
  return job;
}

export async function getJob(id: ID): Promise<JobRecord | undefined> {
  return idbGet<JobRecord>('jobs', id);
}

export async function listJobs(): Promise<JobRecord[]> {
  const jobs = await idbGetAll<JobRecord>('jobs');
  return jobs.sort((a, b) => b.scrapedAt - a.scrapedAt);
}

export async function deleteJob(id: ID): Promise<void> {
  await idbDelete('jobs', id);
}

/* -------------------------- Applications -------------------------- */

export async function listApplications(): Promise<ApplicationRecord[]> {
  const apps = await idbGetAll<ApplicationRecord>('applications');
  return apps.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getApplication(id: ID): Promise<ApplicationRecord | undefined> {
  return idbGet<ApplicationRecord>('applications', id);
}

export async function getApplicationByJob(jobId: ID): Promise<ApplicationRecord | undefined> {
  const matches = await idbGetAllByIndex<ApplicationRecord>('applications', 'jobId', jobId);
  return matches.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export async function getApplicationByUrl(url: string): Promise<ApplicationRecord | undefined> {
  const apps = await listApplications();
  return apps.find((app) => app.jobUrl === url);
}

export async function saveApplication(application: ApplicationRecord): Promise<ApplicationRecord> {
  await idbPut('applications', application);
  return application;
}

export async function deleteApplication(id: ID): Promise<void> {
  const documents = await idbGetAllByIndex<DocumentRecord>('documents', 'applicationId', id);
  await Promise.all(documents.map((doc) => idbDelete('documents', doc.id)));
  await idbDelete('applications', id);
}

/* ---------------------------- Documents --------------------------- */

export async function listDocuments(applicationId?: ID): Promise<DocumentRecord[]> {
  const docs = applicationId
    ? await idbGetAllByIndex<DocumentRecord>('documents', 'applicationId', applicationId)
    : await idbGetAll<DocumentRecord>('documents');
  return docs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getDocument(id: ID): Promise<DocumentRecord | undefined> {
  return idbGet<DocumentRecord>('documents', id);
}

export async function saveDocument(doc: DocumentRecord): Promise<DocumentRecord> {
  await idbPut('documents', doc);
  return doc;
}

export async function deleteDocument(id: ID): Promise<void> {
  await idbDelete('documents', id);
}

/** Documents crossing the messaging boundary must not carry Blobs or source content. */
export function sanitizeDocuments(documents: DocumentRecord[]): DocumentRecord[] {
  return documents.map((document) => ({ ...document, blob: new Blob([], { type: document.mime }), content: undefined }));
}

/* ------------------------------ Events ---------------------------- */

export async function recordEvent(event: Omit<StoredApplicationEvent, 'at'> & { at?: number }): Promise<void> {
  await idbPut('events', { ...event, id: uid('event'), at: event.at ?? Date.now() });
}

export async function listEvents(applicationId?: ID): Promise<(StoredApplicationEvent & { id: ID })[]> {
  const events = applicationId
    ? await idbGetAllByIndex<StoredApplicationEvent & { id: ID }>('events', 'applicationId', applicationId)
    : await idbGetAll<StoredApplicationEvent & { id: ID }>('events');
  return events.sort((a, b) => b.at - a.at);
}

export async function clearAllData(): Promise<void> {
  await Promise.all((Object.keys(STORES) as StoreName[]).map((store) => idbClear(store)));
}

export type { StoreName };
