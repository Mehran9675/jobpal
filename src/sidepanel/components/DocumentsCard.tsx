import type { DocumentRecord } from '@/types';
import { Button, EmptyState, SectionCard, Show } from '@/ui/components';
import { DocumentRow } from './DocumentRow';

export function DocumentsCard({
  documents,
  onDownload,
  onRegenerate,
  onAttachToPage,
  onOpenApplication,
}: {
  documents: DocumentRecord[];
  onDownload: (document: DocumentRecord) => void;
  onRegenerate: (document: DocumentRecord) => void;
  onAttachToPage: (document: DocumentRecord) => void;
  onOpenApplication?: () => void;
}) {
  const hasDocuments = documents.length > 0;

  const renderDocument = (document: DocumentRecord) => (
    <DocumentRow key={document.id} document={document} onDownload={onDownload} onRegenerate={onRegenerate} onAttachToPage={onAttachToPage} />
  );

  return (
    <SectionCard title="Documents" action={onOpenApplication ? <Button size="sm" variant="ghost" onClick={onOpenApplication}>Open</Button> : undefined}>
      <Show if={!hasDocuments}>
        <EmptyState title="No documents yet" text="Press “Tailor & fill” to generate a resume and cover letter for this posting." />
      </Show>
      <Show if={hasDocuments}>
        <div className="list">{documents.map(renderDocument)}</div>
      </Show>
    </SectionCard>
  );
}
