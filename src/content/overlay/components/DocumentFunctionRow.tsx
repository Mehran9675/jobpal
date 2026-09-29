import type { DocumentRecord } from '@/types';
import { patchOverlay, useOverlayState } from '../store';
import { regenerateKind } from '../actions';
import type { DocumentFunctionKind } from '../constants';
import { Icon } from './Icon';
import { Show } from '@/ui/components';
import { DocumentMenu } from './DocumentMenu';

export function DocumentFunctionRow({
  kind,
  label,
  file,
  useOwn,
}: {
  kind: DocumentFunctionKind;
  label: string;
  file: DocumentRecord | null;
  useOwn: boolean;
}) {
  const state = useOverlayState();
  const menuOpen = state.openDocMenu === kind;
  const closeMenu = () => patchOverlay({ openDocMenu: undefined });

  return (
    <div className="jp-doc">
      <div className="jp-doc-info">
        <div className="jp-doc-title-row">
          <div className="jp-doc-fn">{label}</div>
          <Show if={useOwn}>
            <span className="jp-badge jp-badge--soft">your file</span>
          </Show>
        </div>
        <div className="jp-doc-name">{file ? `${file.filename} · ${file.format.toUpperCase()}` : 'Not generated yet'}</div>
      </div>
      <div className="jp-doc-actions">
        <button
          type="button"
          className="jp-mini jp-icon-btn"
          data-menu-toggle="true"
          title={`${label} actions`}
          onClick={(event) => {
            event.stopPropagation();
            patchOverlay({ openDocMenu: menuOpen ? undefined : kind });
          }}
        >
          <Icon name="dots" size={14} />
        </button>
      </div>
      <Show if={menuOpen && Boolean(file)}>
        <DocumentMenu kind={kind} file={file as DocumentRecord} useOwn={useOwn} onClose={closeMenu} />
      </Show>
      <Show if={menuOpen && !file}>
        <div className="jp-doc-menu" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="jp-doc-menu-item"
            disabled={state.busy || !state.aiReady}
            onClick={(event) => {
              event.stopPropagation();
              closeMenu();
              void regenerateKind(kind);
            }}
          >
            <Icon name="sparkles" size={14} />
            <span>Generate now</span>
          </button>
        </div>
      </Show>
    </div>
  );
}
