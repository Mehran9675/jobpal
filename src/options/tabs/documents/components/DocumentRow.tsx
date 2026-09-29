import type { DocumentRecord } from '@/types';
import { Badge, MenuButton, Show } from '@/ui/components';
import { IconDownload, IconExternal, IconEye, IconRefresh, IconTrash } from '@/ui/components/Icons';
import { openDocumentViewer } from '@/lib/viewer';
import { formatBytes, relativeTime } from '@/lib/utils';

export function DocumentRow({
  document,
  onOpenApplication,
  onPreview,
  onDownload,
  onRegenerate,
  onRemove,
}: {
  document: DocumentRecord;
  onOpenApplication: (document: DocumentRecord) => void;
  onPreview: (document: DocumentRecord) => void;
  onDownload: (document: DocumentRecord) => void;
  onRegenerate: (document: DocumentRecord) => void;
  onRemove: (document: DocumentRecord) => void;
}) {
  return (
    <tr>
      <td>
        <div className="strong">{document.filename}</div>
        <div className="tiny muted">
          {document.format.toUpperCase()} · {document.uploaded ? 'uploaded by you' : document.templateId}
        </div>
      </td>
      <td>
        <Show if={Boolean(document.uploaded)}>
          <Badge tone="success">yours</Badge>
        </Show>
        <Show if={!document.uploaded}>
          <Badge tone={document.kind === 'resume' ? 'primary' : document.kind === 'cover_letter' ? 'info' : 'neutral'}>{document.kind.replace('_', ' ')}</Badge>
        </Show>
      </td>
      <td>
        <Show if={Boolean(document.applicationId)}>
          <button className="btn btn--ghost btn--sm" onClick={() => onOpenApplication(document)}>
            {document.jobTitle} - {document.company}
          </button>
        </Show>
        <Show if={!document.applicationId}>
          <span className="muted">-</span>
        </Show>
      </td>
      <td className="muted small nowrap">{formatBytes(document.size)}</td>
      <td className="muted small nowrap">{relativeTime(document.createdAt)}</td>
      <td className="text-right">
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <MenuButton
            label="File actions"
            items={[
              { label: 'Open in new tab', icon: <IconExternal size={14} />, onSelect: () => openDocumentViewer(document.id) },
              { label: 'Preview here', icon: <IconEye size={14} />, onSelect: () => onPreview(document) },
              { label: 'Download', icon: <IconDownload size={14} />, onSelect: () => onDownload(document) },
              ...(document.uploaded
                ? []
                : [{ label: 'Regenerate', icon: <IconRefresh size={14} />, onSelect: () => onRegenerate(document) }]),
              { label: 'Delete', icon: <IconTrash size={14} />, danger: true, onSelect: () => void onRemove(document) },
            ]}
          />
        </div>
      </td>
    </tr>
  );
}
