import type { DocumentRecord } from '@/types';
import { isEditableKind } from '@/lib/doc/content';
import { attachDocument, openDocumentViewer, openEditor, runPickFile } from '../actions';
import { MiniButton } from './MiniButton';
import { Show } from '@/ui/components';

export function DocumentsPageRow({ document }: { document: DocumentRecord }) {
  const filename = document.filename.length > 32 ? `${document.filename.slice(0, 31)}…` : document.filename;
  const editable = isEditableKind(document.kind) && !document.uploaded;

  return (
    <div className="jp-doc">
      <div className="jp-doc-info">
        <div className="jp-doc-title-row">
          <div className="jp-doc-fn">{filename}</div>
          <Show if={Boolean(document.uploaded)}>
            <span className="jp-badge jp-badge--soft">yours</span>
          </Show>
          <Show if={Boolean(document.editedAt)}>
            <span className="jp-badge jp-badge--soft">edited</span>
          </Show>
        </div>
        <div className="jp-doc-name">{`${document.kind.replace('_', ' ')} · ${document.format.toUpperCase()}`}</div>
      </div>
      <div className="jp-doc-actions">
        <Show if={editable}>
          <MiniButton title="See the generated content, edit it and regenerate this file" onClick={() => void openEditor(document.id)}>
            Edit
          </MiniButton>
        </Show>
        <MiniButton title="Attach to the first upload field on the page" onClick={() => void attachDocument(document.id)}>
          Attach
        </MiniButton>
        {/*<MiniButton title="Choose which upload field this file goes in" onClick={() => void runPickFile(document.id, document.kind)}>*/}
        {/*  Field*/}
        {/*</MiniButton>*/}
        <MiniButton onClick={() => openDocumentViewer(document.id)}>View</MiniButton>
      </div>
    </div>
  );
}
