import type { DocumentRecord } from '@/types';
import { isEditableKind } from '@/lib/doc/content';
import { attachDocument, closeAllMenus, downloadDocument, openDocumentViewer, openEditor, regenerateKind, runPickFile } from '../actions';
import { useOverlayState } from '../store';
import type { DocumentFunctionKind } from '../constants';
import { IconMenuItem } from './IconMenuItem';
import { Show } from '@/ui/components';
import type { IconName } from './Icon';

export function DocumentMenu({
  kind,
  file,
  useOwn,
  onClose,
}: {
  kind: DocumentFunctionKind;
  file: DocumentRecord;
  useOwn: boolean;
  onClose: () => void;
}) {
  const state = useOverlayState();

  const run = (action: () => void) => {
    closeAllMenus();
    onClose();
    action();
  };

  const renderMenuItem = (label: string, icon: IconName, action: () => void, disabled = false) => (
    <IconMenuItem key={label} label={label} icon={icon} disabled={disabled} onSelect={action} />
  );

  const isAnswers = kind === 'answers';

  return (
    <div className="jp-doc-menu" onClick={(event) => event.stopPropagation()}>
      {renderMenuItem('View in new tab', 'eye', () => run(() => openDocumentViewer(file.id)))}
      <Show if={!useOwn && isEditableKind(file.kind)}>
        {renderMenuItem('Edit content', 'note', () => run(() => void openEditor(file.id)))}
      </Show>
      {renderMenuItem('Download', 'download', () => run(() => void downloadDocument(file.id)))}
      {useOwn ? null : renderMenuItem('Regenerate', 'sparkles', () => run(() => void regenerateKind(kind)), state.busy || !state.aiReady)}
      {isAnswers ? null : renderMenuItem('Attach to this page', 'attach', () => run(() => void attachDocument(file.id)))}
      {isAnswers ? null : renderMenuItem('Choose upload field', 'target', () => run(() => void runPickFile(file.id, kind)))}
    </div>
  );
}
