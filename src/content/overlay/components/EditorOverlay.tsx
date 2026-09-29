import { useEffect, useMemo, useState } from 'react';
import { isEditableKind } from '@/lib/doc/content';
import { useOverlayState } from '../store';
import { closeEditor, saveEditorContent } from '../actions';
import { parseEditorContent, serializeEditorDraft, type EditorDraft } from '../helpers/editorContent';
import { MiniButton } from './MiniButton';
import { ResumeEditor } from './ResumeEditor';
import { CoverLetterEditor } from './CoverLetterEditor';
import { AnswersEditor } from './AnswersEditor';
import { Show } from '@/ui/components';
import { Icon } from './Icon';

const KIND_LABELS: Record<string, string> = {
  resume: 'Resume',
  cover_letter: 'Cover letter',
  answers: 'Answers',
};

export function EditorOverlay() {
  const state = useOverlayState();
  const [edited, setEdited] = useState<EditorDraft | null>(null);
  const file =
    state.documents.find((entry) => entry.id === state.editorDocumentId) ??
    state.allDocuments.find((entry) => entry.id === state.editorDocumentId) ??
    null;

  // A fresh document always starts from its stored content.
  useEffect(() => {
    setEdited(null);
  }, [state.editorDocumentId, state.editorOriginal]);

  const parsed = useMemo(() => {
    if (!file || !isEditableKind(file.kind) || state.editorOriginal === undefined) return null;
    return parseEditorContent(file.kind, state.editorOriginal);
  }, [file?.id, state.editorOriginal]);

  const draft = edited ?? parsed;
  const kindLabel = file ? KIND_LABELS[file.kind] ?? file.kind : 'Document';
  const canSave = Boolean(draft) && !state.editorBusy && !state.editorLoading;

  // Render helpers only build children when the draft exists, so no editor is
  // created with null data while the content is still loading.
  const renderBody = () => {
    if (!draft) return null;
    if (draft.kind === 'resume') {
      return <ResumeEditor profile={draft.profile} onChange={(profile) => setEdited({ kind: 'resume', profile })} />;
    }
    if (draft.kind === 'cover_letter') {
      return <CoverLetterEditor text={draft.text} onChange={(text) => setEdited({ kind: 'cover_letter', text })} />;
    }
    return <AnswersEditor answers={draft.answers} onChange={(answers) => setEdited({ kind: 'answers', answers })} />;
  };

  return (
    <div
      className="jp-editor"
      onClick={(event) => {
        if (event.target === event.currentTarget && !state.editorBusy) closeEditor();
      }}
    >
      <div className="jp-editor-card">
        <div className="jp-editor-head">
          <div className="jp-editor-title">
            <Icon name="note" size={14} />
            <div>
              <div className="jp-editor-name">Edit {kindLabel.toLowerCase()}</div>
              <div className="jp-editor-file">{file?.filename ?? state.editorDocumentId}</div>
            </div>
          </div>
          <button type="button" className="jp-close" title="Close without saving" onClick={closeEditor}>
            ×
          </button>
        </div>

        <div className="jp-editor-body">
          <Show if={state.editorLoading}>
            <div className="jp-guide-value">Loading the generated content…</div>
          </Show>
          <Show if={Boolean(state.editorError)}>
            <div className="jp-detect">
              <div className="jp-detect-title">
                <Icon name="alert" size={13} />
                <span>Nothing to edit yet</span>
              </div>
              <div className="jp-detect-hint">{state.editorError}</div>
            </div>
          </Show>
          {renderBody()}
          <Show if={!state.editorLoading && !state.editorError && state.editorOriginal !== undefined && !draft}>
            <div className="jp-guide-value">The content of this file could not be read.</div>
          </Show>
        </div>

        <div className="jp-editor-foot">
          <div className="jp-editor-note">Regenerating uses the current design and your edited text. The AI is not called again.</div>
          <div className="jp-editor-buttons">
            <MiniButton onClick={() => setEdited(null)} disabled={!parsed || state.editorBusy}>
              Reset to generated
            </MiniButton>
            <MiniButton onClick={closeEditor} disabled={state.editorBusy}>
              Cancel
            </MiniButton>
            <MiniButton
              className="jp-mini-primary"
              disabled={!canSave || !file}
              onClick={() => {
                if (!file || !draft) return;
                void saveEditorContent(file.id, serializeEditorDraft(draft));
              }}
            >
              {state.editorBusy ? 'Regenerating…' : 'Save & regenerate'}
            </MiniButton>
          </div>
        </div>
      </div>
    </div>
  );
}
