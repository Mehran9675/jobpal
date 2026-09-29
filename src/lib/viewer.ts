export function documentViewerUrl(documentId: string): string {
  return chrome.runtime.getURL(`viewer.html?id=${encodeURIComponent(documentId)}`);
}

/** Opens a generated document in a new tab in the same browser. */
export function openDocumentViewer(documentId: string): void {
  window.open(documentViewerUrl(documentId), '_blank', 'noopener');
}
