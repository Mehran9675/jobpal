import { useMemo, useState } from 'react';
import type { AppSettings, ApplicationRecord, ApplicationStatus } from '@/types';
import { APPLICATION_STATUSES } from '@/types';
import { sendMessage, errorMessage } from '@/lib/messaging';
import { Button, EmptyState, Input, SectionCard, Select, Show } from '@/ui/components';
import { IconDownload } from '@/ui/components/Icons';
import { useDocuments, useFilteredApplications } from '@/ui/hooks';
import { useToast } from '@/ui/components/Toast';
import { aiStatusFor } from '@/lib/ai/status';
import { ApplicationDetail } from './applications/components/ApplicationDetail';
import { ApplicationRow } from './applications/components/ApplicationRow';

export function ApplicationsTab({
  applications,
  selectedId,
  navigate,
  settings,
}: {
  applications: ApplicationRecord[];
  selectedId?: string;
  navigate: (tab: string, param?: string) => void;
  settings: AppSettings;
}) {
  const toast = useToast();
  const { query, setQuery, status, setStatus, filtered } = useFilteredApplications(applications);
  const selected = useMemo(() => applications.find((application) => application.id === selectedId), [applications, selectedId]);
  const { data: documents, reload: reloadDocuments } = useDocuments(selected?.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const updateStatus = async (application: ApplicationRecord, next: ApplicationStatus) => {
    setBusy('status');
    try {
      await sendMessage('applications.update', { id: application.id, patch: { status: next } });
      toast.success(`Marked as ${next}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const saveNotes = async (application: ApplicationRecord, value: string) => {
    try {
      await sendMessage('applications.update', { id: application.id, patch: { notes: value } });
      toast.success('Notes saved.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const regenerate = async (application: ApplicationRecord) => {
    setBusy('regen');
    try {
      await sendMessage('pipeline.regenerate', { applicationId: application.id }, { timeout: 240000 });
      await reloadDocuments();
      toast.success('Documents regenerated with your current template and profile.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (application: ApplicationRecord) => {
    if (!confirm(`Delete the application for ${application.jobTitle} at ${application.company}? Documents will be deleted too.`)) return;
    await sendMessage('applications.delete', { id: application.id });
    navigate('applications');
    toast.push('Application deleted.');
  };

  const exportAll = async () => {
    try {
      const { json } = await sendMessage('applications.export', undefined);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `jobpaal-applications-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success('Export downloaded.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const renderStatusFilter = (entry: { id: ApplicationStatus; label: string }) => {
    const count = applications.filter((application) => application.status === entry.id).length;
    if (count === 0) return null;
    return (
      <button key={entry.id} className={`btn btn--sm ${status === entry.id ? 'btn--primary' : 'btn--outline'}`} onClick={() => setStatus(status === entry.id ? 'all' : entry.id)}>
        {entry.label} · {count}
      </button>
    );
  };

  const renderStatusOption = (entry: { id: ApplicationStatus; label: string }) => (
    <option key={entry.id} value={entry.id}>
      {entry.label}
    </option>
  );

  const renderApplication = (application: ApplicationRecord) => (
    <ApplicationRow key={application.id} application={application} onOpen={() => navigate('applications', application.id)} />
  );

  if (selected) {
    const ai = aiStatusFor(settings);
    return <ApplicationDetail application={selected} documents={documents ?? []} settings={settings} aiReady={ai.ready} aiReason={ai.reason} navigate={navigate} onBack={() => navigate('applications')} onRegenerate={regenerate} onDelete={remove} onStatus={updateStatus} onSaveNotes={saveNotes} busy={busy} />;
  }

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">Applications</h1>
          <p className="main__subtitle">
            A complete record of every application: documents, written answers and a timeline you control. Use the status column to track progress from applied to offer.
          </p>
        </div>
        <Button variant="outline" icon={<IconDownload size={15} />} onClick={() => void exportAll()}>
          Export JSON
        </Button>
      </header>

      <div className="row row--wrap mb-2">{APPLICATION_STATUSES.map(renderStatusFilter)}</div>

      <SectionCard
        title={`${filtered.length} application${filtered.length === 1 ? '' : 's'}`}
        action={
          <div className="row">
            <Input placeholder="Search role, company, notes…" value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: 240 }} />
            <Select value={status} onChange={(event) => setStatus(event.target.value)} style={{ width: 170 }}>
              <option value="all">All statuses</option>
              {APPLICATION_STATUSES.map(renderStatusOption)}
            </Select>
          </div>
        }
      >
        <Show if={filtered.length === 0}>
          <EmptyState title="No applications match" text="Try a different filter, or tailor documents from a job posting to create one." />
        </Show>
        <Show if={filtered.length > 0}>
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Company</th>
                <th>Status</th>
                <th>Match</th>
                <th>Docs</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>{filtered.map(renderApplication)}</tbody>
          </table>
        </Show>
      </SectionCard>
    </>
  );
}
