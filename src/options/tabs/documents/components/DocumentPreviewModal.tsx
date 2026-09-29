import type { DocumentRecord } from '@/types';
import { Button, Modal, Show } from '@/ui/components';
import { IconDownload, IconExternal } from '@/ui/components/Icons';
import { openDocumentViewer } from '@/lib/viewer';
import type { DocumentPreview } from '../helpers/types';

export function DocumentPreviewModal({
  preview,
  onClose,
  onDownload,
}: {
  preview: DocumentPreview | null;
  onClose: () => void;
  onDownload: (document: DocumentRecord) => void;
}) {
  if (!preview) return null;
  const { document, url } = preview;
  const isEmbedded = document.format === 'pdf' || document.format === 'html';

  return (
    <Modal open title={document.filename} onClose={onClose} wide>
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <Show if={isEmbedded}>
          <iframe src={url} title={document.filename} style={{ width: '100%', height: '70vh', border: 'none', background: '#fff' }} />
        </Show>
        <Show if={!isEmbedded}>
          <pre className="code-block" style={{ maxHeight: '70vh' }}>
            {document.textPreview ?? 'Preview not available — download the file to view it.'}
          </pre>
        </Show>
      </div>
      <div className="modal__footer">
        <Button variant="outline" onClick={() => openDocumentViewer(document.id)} icon={<IconExternal size={14} />}>
          Open in new tab
        </Button>
        <Button variant="outline" onClick={() => void onDownload(document)} icon={<IconDownload size={14} />}>
          Download
        </Button>
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
