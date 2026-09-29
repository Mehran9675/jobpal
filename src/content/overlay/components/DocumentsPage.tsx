import type { DocumentRecord } from '@/types';
import { closeDocumentsPage, openAllDocuments } from '../actions';
import { useOverlayState } from '../store';
import { MiniButton } from './MiniButton';
import { DocumentsPageRow } from './DocumentsPageRow';
import { Show } from '@/ui/components';

const MAX_VISIBLE = 60;

export function DocumentsPage() {
  const state = useOverlayState();
  const renderDocument = (document: DocumentRecord) => <DocumentsPageRow key={document.id} document={document} />;
  const visible = state.allDocuments.slice(0, MAX_VISIBLE);
  const hidden = state.allDocuments.length - visible.length;

  return (
    <div className="jp-docs-page">
      <div className="jp-docs-head">
        <button type="button" className="jp-link" onClick={() => closeDocumentsPage()}>
          ← Back
        </button>
        <MiniButton onClick={() => void openAllDocuments(true)}>Refresh</MiniButton>
      </div>
      <div className="jp-guide-hint">
        Choose any document — generated for this or another application, or one you uploaded — and place it on the form.
      </div>
      <Show if={state.allDocsLoading}>
        <div className="jp-guide-value">Loading documents…</div>
      </Show>
      <Show if={!state.allDocsLoading && state.allDocuments.length === 0}>
        <div className="jp-guide-value">No documents stored yet.</div>
      </Show>
      <Show if={!state.allDocsLoading && state.allDocuments.length > 0}>
        <div className="jp-alldocs">{visible.map(renderDocument)}</div>
      </Show>
      <Show if={hidden > 0}>
        <div className="jp-guide-value">{hidden} more in the management page.</div>
      </Show>
    </div>
  );
}
