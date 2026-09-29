import type { DocumentRecord } from '@/types';
import { MenuButton } from '@/ui/components';
import { IconDownload, IconEye, IconRefresh } from '@/ui/components/Icons';
import { relativeTime } from '@/lib/utils';
import { openDocumentViewer } from '@/lib/viewer';

export function FileRow({
  document,
  onDownload,
  onRegenerate,
}: {
  document: DocumentRecord;
  onDownload: (document: DocumentRecord) => void;
  onRegenerate: (document: DocumentRecord) => void;
}) {
  return (
    <div className="list-item">
      <div className="list-item__main">
        <div className="list-item__title">{document.filename}</div>
        <div className="list-item__meta">
          {document.kind.replace('_', ' ')} · {document.format.toUpperCase()} · {relativeTime(document.createdAt)}
        </div>
      </div>
      <MenuButton
        label="File actions"
        items={[
          { label: 'View in new tab', icon: <IconEye size={14} />, onSelect: () => openDocumentViewer(document.id) },
          { label: 'Download', icon: <IconDownload size={14} />, onSelect: () => onDownload(document) },
          { label: 'Regenerate', icon: <IconRefresh size={14} />, onSelect: () => onRegenerate(document) },
        ]}
      />
    </div>
  );
}
