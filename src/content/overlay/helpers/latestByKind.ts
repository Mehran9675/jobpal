import type { DocumentRecord } from '@/types';

/** Newest document per kind (the list is already sorted newest-first). */
export function latestByKind(documents: DocumentRecord[]): Map<string, DocumentRecord> {
  const map = new Map<string, DocumentRecord>();
  for (const document of documents) {
    if (!map.has(document.kind)) map.set(document.kind, document);
  }
  return map;
}
