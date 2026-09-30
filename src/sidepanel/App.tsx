import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApplicationRecord, DocumentRecord, ExtractedJob } from '@/types';
import { sendMessage, sendTabMessage, errorMessage } from '@/lib/messaging';
import { aiStatusFor } from '@/lib/ai/status';
import { findApplicationForUrl } from '@/lib/applications/match';
import { matchFromAnalysis } from '@/lib/job/match';
import { buildPastedJob } from '@/lib/job/pasted';
import { PasteJobModal, type PastedJobInput } from '@/ui/components/PasteJobModal';
import { Show, TermsNotice, type MatchCardData } from '@/ui/components';
import { termsAccepted } from '@/lib/legal';
import { useToast } from '@/ui/components/Toast';
import { useApplications, usePageContext, useRuntimeEvents, useSettings, useTheme } from '@/ui/hooks';
import { SidePanelHeader } from './components/SidePanelHeader';
import { AiNotice } from './components/AiNotice';
import { JobCard } from './components/JobCard';
import { DocumentsCard } from './components/DocumentsCard';
import { AnswersCard } from './components/AnswersCard';

export function SidePanelApp() {
  const { settings } = useSettings();
  useTheme(settings);
  const { context, tabId, reload: reloadContext } = usePageContext(4000);
  const { applications, reload: reloadApplications } = useApplications();
  const toast = useToast();
  const [job, setJob] = useState<ExtractedJob | null>(null);
  const [match, setMatch] = useState<MatchCardData | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentsVersion, setDocumentsVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [progressText, setProgressText] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const ai = useMemo(() => aiStatusFor(settings), [settings]);

  useEffect(() => {
    if (!tabId || !context?.hasJob) {
      setJob(null);
      return;
    }
    void (async () => {
      try {
        const extracted = (await sendTabMessage(tabId, 'page.extractJob', undefined, { timeout: 20000 })) as ExtractedJob | null;
        setJob(extracted);
      } catch {
        setJob(null);
      }
    })();
  }, [tabId, context?.url, context?.hasJob]);

  const application = useMemo(() => {
    if (!context) return undefined;
    return findApplicationForUrl(applications, context.url, context.jobTitle, context.company);
  }, [applications, context]);

  useEffect(() => {
    void (async () => {
      if (!application) {
        setDocuments([]);
        return;
      }
      setDocuments(await sendMessage('documents.list', { applicationId: application.id }).catch(() => []));
    })();
  }, [application, documentsVersion]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const url = context?.url;
      if (!url) {
        setMatch(null);
        return;
      }
      const { job: record } = await sendMessage('job.forUrl', { url, title: context?.jobTitle, company: context?.company }).catch(() => ({ job: null }));
      if (cancelled) return;
      if (record?.analysis) {
        setMatch(matchFromAnalysis(record.analysis));
      } else if (record?.matchScore !== undefined) {
        setMatch({ score: record.matchScore, matchedSkills: [], missingSkills: record.missingSkills, reasons: record.matchReasons });
      } else if (application?.matchScore !== undefined) {
        setMatch({ score: application.matchScore, matchedSkills: [], missingSkills: [], reasons: [] });
      } else {
        setMatch(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context?.url, context?.jobTitle, context?.company, application]);

  useRuntimeEvents((name, data) => {
    if (name === 'pipeline-progress') {
      const message = (data as { message?: string } | undefined)?.message;
      if (message) setProgressText(message);
    }
    if (name === 'applications-changed') {
      void reloadApplications();
      void reloadContext();
    }
  });

  const run = useCallback(
    async (name: string, task: () => Promise<string | void>) => {
      setBusy(name);
      setProgressText('');
      try {
        const message = await task();
        if (typeof message === 'string') toast.success(message);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setBusy(null);
        setProgressText('');
      }
    },
    [toast],
  );

  const openOptions = useCallback((tab: string) => void sendMessage('app.openOptions', { tab }), []);

  const tailor = () =>
    run('tailor', async () => {
      if (!tabId) throw new Error('No active tab.');
      const extracted = job ?? ((await sendTabMessage(tabId, 'page.extractJob', undefined, { timeout: 20000 })) as ExtractedJob | null);
      if (!extracted) throw new Error('No job posting detected.');
      const probe = await sendTabMessage(tabId, 'page.detectForm', undefined, { timeout: 20000 }).catch(() => undefined);
      const result = await sendMessage(
        'pipeline.tailor',
        { job: extracted, questions: probe?.found ? probe.questions : undefined, form: { hasCoverLetterField: probe?.hasCoverLetterField } },
        { timeout: 240000 },
      );
      setDocuments(result.documents);
      await reloadApplications();
      const report = await sendTabMessage(tabId, 'page.fillForm', { documentIds: result.documents.map((document) => document.id), answers: result.answers }, { timeout: 120000 });
      return `Documents ready - filled ${report.filled} fields.${report.filled > 0 ? ' If the site flags a field as empty, click it and type a character.' : ''}`;
    });

  const checkMatch = () =>
    run('match', async () => {
      if (!job) throw new Error('No job posting detected.');
      const saved = await sendMessage('job.save', { job });
      const result = await sendMessage('job.match', { jobId: saved.id });
      setMatch({ score: result.score, reasons: result.reasons, matchedSkills: result.matched, missingSkills: result.missing, recommendation: result.recommendation });
      setMatchOpen(true);
    });

  const submitPasted = useCallback(
    async (input: PastedJobInput) => {
      const pastedJob = buildPastedJob(input, context);
      if (tabId !== null) {
        await sendTabMessage(tabId, 'page.setPastedDescription', { text: input.text, title: input.title, company: input.company }, { timeout: 8000 }).catch(() => undefined);
      }
      const result = await sendMessage('pipeline.tailor', { job: pastedJob }, { timeout: 240000 });
      setDocuments(result.documents);
      await reloadApplications();
      toast.success('Documents ready.');
    },
    [context, reloadApplications, tabId, toast],
  );

  const download = useCallback(
    (document: DocumentRecord) => {
      void run(document.id, async () => {
        await sendMessage('doc.download', { documentId: document.id });
        return 'Download started.';
      });
    },
    [run],
  );

  const regenerate = useCallback(
    (document: DocumentRecord) => {
      const applicationId = document.applicationId ?? application?.id;
      if (!applicationId) {
        toast.error('This file is not linked to an application.');
        return;
      }
      void sendMessage('doc.render', { applicationId, kinds: [document.kind] }, { timeout: 240000 })
        .then(() => {
          setDocumentsVersion((version) => version + 1);
          toast.success(`${document.kind.replace('_', ' ')} regenerated.`);
        })
        .catch((error) => toast.error(errorMessage(error)));
    },
    [application, toast],
  );

  const attachToPage = useCallback(
    (document: DocumentRecord) => {
      if (tabId === null) {
        toast.error('No active tab.');
        return;
      }
      void sendTabMessage(tabId, 'page.pickFileTarget', { documentId: document.id, kind: document.kind }, { timeout: 120000 })
        .then((result) => {
          if (!result) toast.push('Selection cancelled.');
          else toast.success(result.attached ? 'File attached.' : 'Field remembered - attach manually if it failed.');
        })
        .catch((error) => toast.error(errorMessage(error)));
    },
    [tabId, toast],
  );

  const copyAnswers = useCallback(async () => {
    const answers = application?.answers ?? [];
    if (answers.length === 0) return;
    try {
      await navigator.clipboard.writeText(answers.map((answer) => `${answer.question}\n${answer.answer}`).join('\n\n'));
      toast.success('Answers copied.');
    } catch {
      toast.error('Clipboard unavailable.');
    }
  }, [application, toast]);

  const copyAnswer = useCallback(
    async (answer: string) => {
      try {
        await navigator.clipboard.writeText(answer);
        toast.success('Answer copied.');
      } catch {
        toast.error('Clipboard unavailable.');
      }
    },
    [toast],
  );

  const guideMe = useCallback(() => {
    if (tabId === null) return;
    void sendTabMessage(tabId, 'page.openGuide', undefined, { timeout: 10000 })
      .then(() => toast.push('Field guide opened on the page.'))
      .catch((error) => toast.error(errorMessage(error)));
  }, [tabId, toast]);

  const siteLabel = context?.site && context.site !== 'other' ? context.site : 'No job detected';
  const showAnswers = (application?.answers ?? []).length > 0;
  const title = job?.title ?? context?.jobTitle ?? 'No job detected';
  const company = job?.company ?? context?.company ?? 'Open a job posting to see tailored actions here.';

  if (!termsAccepted(settings)) {
    return (
      <div className="sidepanel">
        <SidePanelHeader siteLabel={siteLabel} onOpenManagement={() => openOptions('dashboard')} />
        <div className="sidepanel__body">
          <TermsNotice onReview={() => openOptions('dashboard')} />
        </div>
      </div>
    );
  }

  return (
    <div className="sidepanel">
      <SidePanelHeader siteLabel={siteLabel} onOpenManagement={() => openOptions('dashboard')} />
      <div className="sidepanel__body">
        <Show if={!ai.ready}>
          <AiNotice reason={ai.reason} onConnect={() => openOptions('ai')} />
        </Show>
        <JobCard
          context={context}
          title={title}
          company={company}
          match={match}
          matchOpen={matchOpen}
          onToggleMatch={() => setMatchOpen((value) => !value)}
          onRecalculate={() => void checkMatch()}
          canRecalculate={Boolean(job) && ai.ready}
          busyLabel={busy}
          progressText={progressText}
          onStop={() =>
            void sendMessage('pipeline.cancel', undefined)
              .then(() => toast.push('Stopping after the current step…'))
              .catch(() => toast.error('Could not send the stop request.'))
          }
          onTailor={() => void tailor()}
          onGuide={() => guideMe()}
          onPaste={() => setPasteOpen(true)}
          aiReady={ai.ready}
        />
        <DocumentsCard
          documents={documents}
          onDownload={download}
          onRegenerate={regenerate}
          onAttachToPage={attachToPage}
          onOpenApplication={application ? () => openOptions(`applications/${application.id}`) : undefined}
        />
        <Show if={showAnswers}>
          <AnswersCard application={application as ApplicationRecord} onCopyAll={() => void copyAnswers()} onCopyAnswer={(answer) => void copyAnswer(answer)} />
        </Show>
      </div>
      <PasteJobModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        defaultTitle={context?.jobTitle ?? context?.title}
        defaultCompany={context?.company}
        onTailor={(input) => submitPasted(input)}
      />
    </div>
  );
}
