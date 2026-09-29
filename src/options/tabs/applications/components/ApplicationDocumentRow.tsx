import type { DocumentRecord } from '@/types';
import { MenuButton } from '@/ui/components';
import { IconDownload, IconExternal, IconFile } from '@/ui/components/Icons';
import { openDocumentViewer } from '@/lib/viewer';
import { formatBytes, relativeTime } from '@/lib/utils';

export function ApplicationDocumentRow({ document, onDownload }: { document: DocumentRecord; onDownload: (document: DocumentRecord) => void }) {
  return (
    <div className="list-item">
      <IconFile size={16} />
      <div className="list-item__main">
        <div className="list-item__title">{document.filename}</div>
        <div className="list-item__meta">
          {document.kind.replace('_', ' ')} · {document.format.toUpperCase()} · {formatBytes(document.size)} · {relativeTime(document.createdAt)}
        </div>
      </div>
      <MenuButton
        label="File actions"
        items={[
          { label: 'Open in new tab', icon: <IconExternal size={14} />, onSelect: () => openDocumentViewer(document.id) },
          { label: 'Download', icon: <IconDownload size={14} />, onSelect: () => onDownload(document) },
        ]}
      />
    </div>
  );
}
