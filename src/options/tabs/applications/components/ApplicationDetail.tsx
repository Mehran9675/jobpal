import { useState } from 'react';
import type { AnswerRecord, AppSettings, ApplicationRecord, ApplicationStatus, DocumentRecord, TimelineEvent } from '@/types';
import { APPLICATION_STATUSES } from '@/types';
import { sendMessage, errorMessage } from '@/lib/messaging';
import { Badge, Button, EmptyState, Field, ScoreRing, SectionCard, Select, Show, Textarea } from '@/ui/components';
import { IconExternal, IconFile, IconNote, IconRefresh, IconTrash } from '@/ui/components/Icons';
import { useToast } from '@/ui/components/Toast';
import { relativeTime } from '@/lib/utils';
import { ApplicationAnswerCard } from './ApplicationAnswerCard';
import { ApplicationDocumentRow } from './ApplicationDocumentRow';
import { TimelineEventRow } from './TimelineEventRow';

export function ApplicationDetail({
  application,
  documents,
  settings,
  aiReady,
  aiReason,
  navigate,
  onBack,
  onRegenerate,
  onDelete,
  onStatus,
  onSaveNotes,
  busy,
}: {
  application: ApplicationRecord;
  documents: DocumentRecord[];
  settings: AppSettings;
  aiReady: boolean;
  aiReason?: string;
  navigate: (tab: string, param?: string) => void;
  onBack: () => void;
  onRegenerate: (application: ApplicationRecord) => void;
  onDelete: (application: ApplicationRecord) => void;
  onStatus: (application: ApplicationRecord, status: ApplicationStatus) => void;
  onSaveNotes: (application: ApplicationRecord, value: string) => void;
  busy: string | null;
}) {
  const [notes, setNotes] = useState(application.notes);
  const toast = useToast();

  const download = async (document: DocumentRecord) => {
    try {
      await sendMessage('doc.download', { documentId: document.id });
      toast.success('Download started.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const copyAnswer = (answer: AnswerRecord) => {
    void navigator.clipboard
      .writeText(answer.answer)
      .then(() => toast.success('Answer copied.'))
      .catch(() => toast.error('Clipboard unavailable.'));
  };

  const copyAllAnswers = () => {
    void navigator.clipboard
      .writeText(application.answers.map((answer) => `${answer.question}\n${answer.answer}`).join('\n\n'))
      .then(() => toast.success('All answers copied.'))
      .catch(() => toast.error('Clipboard unavailable.'));
  };

  const renderStatusOption = (entry: { id: ApplicationStatus; label: string }) => (
    <option key={entry.id} value={entry.id}>
      {entry.label}
    </option>
  );

  const renderDocument = (document: DocumentRecord) => <ApplicationDocumentRow key={document.id} document={document} onDownload={download} />;

  const renderAnswer = (answer: AnswerRecord, index: number) => <ApplicationAnswerCard key={index} answer={answer} onCopy={copyAnswer} />;

  const renderTimelineEvent = (event: TimelineEvent, index: number) => <TimelineEventRow key={index} event={event} />;

  return (
    <>
      <header className="main__header">
        <div>
          <Button size="sm" variant="ghost" onClick={onBack} className="mb-2">
            ← Back to applications
          </Button>
          <h1 className="main__title">{application.jobTitle}</h1>
          <p className="main__subtitle">
            {application.company} · {application.site} · created {relativeTime(application.createdAt)}
          </p>
        </div>
        <div className="row">
          <Show if={application.matchScore !== undefined}>
            <ScoreRing score={application.matchScore ?? 0} />
          </Show>
          <Button variant="outline" icon={<IconExternal size={15} />} onClick={() => void window.open(application.jobUrl, '_blank')}>
            Job posting
          </Button>
          <Button
            variant="outline"
            icon={<IconRefresh size={15} />}
            loading={busy === 'regen'}
            disabled={!aiReady}
            title={aiReady ? 'Regenerate documents with your current template and profile' : `Connect an AI provider first - ${aiReason ?? ''}`}
            onClick={() => onRegenerate(application)}
          >
            Regenerate
          </Button>
          <Button variant="danger" icon={<IconTrash size={15} />} onClick={() => onDelete(application)}>
            Delete
          </Button>
        </div>
      </header>

      <div className="grid grid--2">
        <SectionCard title="Status" hint="Keep this updated - JobPaal uses it for follow-ups and duplicate detection.">
          <Field label="Pipeline stage">
            <Select className="status-select" value={application.status} onChange={(event) => onStatus(application, event.target.value as ApplicationStatus)}>
              {APPLICATION_STATUSES.map(renderStatusOption)}
            </Select>
          </Field>
          <div className="divider" />
          <div className="col">
            <Show if={application.answers.length > 0}>
              <div className="row row--between">
                <span className="small muted">Written answers</span>
                <Badge tone="info">{application.answers.length}</Badge>
              </div>
            </Show>
            <div className="row row--between">
              <span className="small muted">Documents</span>
              <Badge tone="primary">{documents.length}</Badge>
            </div>
            <div className="row row--between">
              <span className="small muted">Template</span>
              <span className="small">{settings.document.templateId}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Notes">
          <Textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Recruiter names, interview prep notes, follow-up dates…" />
          <div className="row mt-1">
            <Button size="sm" variant="primary" onClick={() => onSaveNotes(application, notes)}>
              Save notes
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNotes(application.notes)}>
              Reset
            </Button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Documents" hint="Everything generated for this application. Preview or download any file.">
        <Show if={documents.length === 0}>
          <EmptyState icon={<IconFile size={20} />} title="No documents" text="Press “Regenerate” to build a fresh set with your current template." />
        </Show>
        <Show if={documents.length > 0}>
          <div className="list">{documents.map(renderDocument)}</div>
        </Show>
      </SectionCard>

      <SectionCard title="Written answers" hint="Exactly what was submitted on the form - copy any answer, or all of them, for your own records or manual applications.">
        <Show if={application.answers.length === 0}>
          <EmptyState icon={<IconNote size={20} />} title="No written answers" text="Screening answers appear here after JobPaal fills a form with questions." />
        </Show>
        <Show if={application.answers.length > 0}>
          <div className="row mb-2">
            <Button size="sm" variant="outline" onClick={copyAllAnswers}>
              Copy all answers
            </Button>
          </div>
          <div className="col">{application.answers.map(renderAnswer)}</div>
        </Show>
      </SectionCard>

      <SectionCard title="Timeline">
        <div className="col">{[...application.timeline].reverse().map(renderTimelineEvent)}</div>
      </SectionCard>
    </>
  );
}
