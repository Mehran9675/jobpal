import { useEffect, useMemo, useState } from 'react';
import type { AppSettings, ApplicationRecord, DocumentRecord } from '@/types';
import { sendMessage, errorMessage } from '@/lib/messaging';
import { Button, EmptyState, Field, SectionCard, Select, Show } from '@/ui/components';
import { IconFile, IconRefresh } from '@/ui/components/Icons';
import { useDocuments } from '@/ui/hooks';
import { useToast } from '@/ui/components/Toast';
import { DocumentPreviewModal } from './documents/components/DocumentPreviewModal';
import { DocumentRow } from './documents/components/DocumentRow';
import type { DocumentPreview } from './documents/helpers/types';
import { formatBytes, relativeTime } from '@/lib/utils';

export function DocumentsTab({
  applications,
  navigate,
}: {
  applications: ApplicationRecord[];
  navigate: (tab: string, param?: string) => void;
  settings?: AppSettings;
}) {
  const { data: documents, reload } = useDocuments();
  const toast = useToast();
  const [kind, setKind] = useState('all');
  const [applicationId, setApplicationId] = useState('all');
  const [preview, setPreview] = useState<DocumentPreview | null>(null);

  const filtered = useMemo(() => {
    return (documents ?? []).filter((document) => {
      if (kind !== 'all' && document.kind !== kind) return false;
      if (applicationId !== 'all' && document.applicationId !== applicationId) return false;
      return true;
    });
  }, [documents, kind, applicationId]);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const openPreview = async (document: DocumentRecord) => {
    try {
      const file = await sendMessage('doc.getBlob', { documentId: document.id });
      const binary = atob(file.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: file.mime });
      setPreview({ document, url: URL.createObjectURL(blob) });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const download = async (document: DocumentRecord) => {
    try {
      await sendMessage('doc.download', { documentId: document.id });
      toast.success(`Downloading ${document.filename}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async (document: DocumentRecord) => {
    if (!confirm(`Delete ${document.filename}?`)) return;
    await sendMessage('doc.delete', { documentId: document.id });
    await reload();
    toast.push('Document deleted.');
  };

  const regenerate = async (document: DocumentRecord) => {
    if (!document.applicationId) {
      toast.warning('This file is not linked to an application.');
      return;
    }
    try {
      await sendMessage('doc.render', { applicationId: document.applicationId, kinds: [document.kind] }, { timeout: 240000 });
      await reload();
      toast.success(`${document.kind.replace('_', ' ')} regenerated with your current design.`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const renderApplicationOption = (application: ApplicationRecord) => (
    <option key={application.id} value={application.id}>
      {application.jobTitle} - {application.company}
    </option>
  );

  const renderDocument = (document: DocumentRecord) => (
    <DocumentRow
      key={document.id}
      document={document}
      onOpenApplication={() => navigate('applications', document.applicationId)}
      onPreview={(entry) => void openPreview(entry)}
      onDownload={(entry) => void download(entry)}
      onRegenerate={(entry) => void regenerate(entry)}
      onRemove={(entry) => void remove(entry)}
    />
  );

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">Documents</h1>
          <p className="main__subtitle">Every resume, cover letter and answer sheet JobPaal has generated, grouped by application. Everything is stored locally.</p>
        </div>
        <Button variant="outline" icon={<IconRefresh size={15} />} onClick={() => void reload()}>
          Refresh
        </Button>
      </header>

      <SectionCard
        title={`${filtered.length} document${filtered.length === 1 ? '' : 's'}`}
        action={
          <div className="row">
            <Select value={kind} onChange={(event) => setKind(event.target.value)} style={{ width: 160 }}>
              <option value="all">All types</option>
              <option value="resume">Resumes</option>
              <option value="cover_letter">Cover letters</option>
              <option value="answers">Answer sheets</option>
              <option value="json_resume">JSON Resume</option>
            </Select>
            <Select value={applicationId} onChange={(event) => setApplicationId(event.target.value)} style={{ width: 220 }}>
              <option value="all">All applications</option>
              {applications.map(renderApplicationOption)}
            </Select>
          </div>
        }
      >
        <Show if={filtered.length === 0}>
          <EmptyState
            icon={<IconFile size={22} />}
            title="Nothing here yet"
            text="Generate documents from any job posting - they will be archived here with the application they belong to."
          />
        </Show>
        <Show if={filtered.length > 0}>
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Application</th>
                <th>Size</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>{filtered.map(renderDocument)}</tbody>
          </table>
        </Show>
      </SectionCard>

      <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} onDownload={(document) => void download(document)} />

      <SectionCard title="Storage" hint="Documents live in your browser's IndexedDB. They are never uploaded anywhere except to your configured AI provider.">
        <div className="grid grid--3">
          <Field label="Total documents">
            <div className="strong">{documents?.length ?? 0}</div>
          </Field>
          <Field label="Total size">
            <div className="strong">{formatBytes((documents ?? []).reduce((sum, document) => sum + document.size, 0))}</div>
          </Field>
          <Field label="Oldest">
            <div className="strong">
              {(documents ?? []).length > 0 ? relativeTime(Math.min(...(documents ?? []).map((document) => document.createdAt))) : '-'}
            </div>
          </Field>
        </div>
      </SectionCard>
    </>
  );
}
