import type { DocumentRecord } from '@/types';
import { Button, EmptyState, Show } from '@/ui/components';
import { IconSparkles } from '@/ui/components/Icons';
import { FileRow } from './FileRow';

const MAX_VISIBLE_FILES = 3;

export function FilesCard({
  documents,
  onDownload,
  onRegenerate,
  onViewAll,
}: {
  documents: DocumentRecord[];
  onDownload: (document: DocumentRecord) => void;
  onRegenerate: (document: DocumentRecord) => void;
  onViewAll: () => void;
}) {
  const hasDocuments = documents.length > 0;
  const visible = documents.slice(0, MAX_VISIBLE_FILES);
  const hidden = documents.length - visible.length;

  const renderFile = (document: DocumentRecord) => (
    <FileRow key={document.id} document={document} onDownload={onDownload} onRegenerate={onRegenerate} />
  );

  return (
    <div className="card card--flat">
      <div className="card__header">
        <div className="card__title">
          <IconSparkles size={14} /> Documents
        </div>
        <span className="tiny muted">{hasDocuments ? documents.length : ''}</span>
      </div>
      <Show if={!hasDocuments}>
        <EmptyState title="No documents yet" text="Generate them for this job, or open the management page to see everything you have stored." />
      </Show>
      <Show if={hasDocuments}>
        <>
          <div className="list">{visible.map(renderFile)}</div>
          <Show if={hidden > 0}>
            <Button variant="ghost" size="sm" className="mt-1" onClick={onViewAll}>
              {`View all ${documents.length} files`}
            </Button>
          </Show>
        </>
      </Show>
    </div>
  );
}
