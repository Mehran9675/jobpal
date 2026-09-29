import { openAllDocuments, regenerateAllDocuments } from '../actions';
import { useOverlayState } from '../store';
import { DOC_FUNCTIONS } from '../constants';
import { latestByKind } from '../helpers/latestByKind';
import { MiniButton } from './MiniButton';
import { DocumentFunctionRow } from './DocumentFunctionRow';
import { Show } from '@/ui/components';
import { Icon } from './Icon';

export function DocumentsSection() {
  const state = useOverlayState();
  const latest = latestByKind(state.documents);
  const uploadedByKind = latestByKind(state.uploaded);

  const renderDocumentFunction = (fn: (typeof DOC_FUNCTIONS)[number]) => {
    const ownFile = uploadedByKind.get(fn.kind);
    const useOwn = state.fileSource === 'uploaded' && Boolean(ownFile);
    const file = (useOwn ? ownFile : latest.get(fn.kind)) ?? null;
    return <DocumentFunctionRow key={fn.kind} kind={fn.kind} label={fn.label} file={file} useOwn={useOwn} />;
  };

  return (
    <div className="jp-docs">
      <div className="jp-docs-head">
        <span className="jp-guide-label">
          <Icon name="folder" size={13} />
          <span>Documents</span>
        </span>
        <div className="jp-doc-actions">
          <Show if={state.documents.length > 0}>
            <MiniButton
              onClick={() => void regenerateAllDocuments()}
              disabled={state.busy || !state.aiReady}
              title={state.aiReady ? 'Regenerate every document with your current design' : 'Connect an AI provider first'}
            >
              Regenerate all
            </MiniButton>
          </Show>
          <button type="button" className="jp-link" title="Pick any document you have stored" onClick={() => void openAllDocuments()}>
            All documents
          </button>
        </div>
      </div>
      <Show if={state.filesLoading}>
        <div className="jp-guide-value">Loading documents…</div>
      </Show>
      <Show if={!state.filesLoading}>{DOC_FUNCTIONS.map(renderDocumentFunction)}</Show>
    </div>
  );
}
