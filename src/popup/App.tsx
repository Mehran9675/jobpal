import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApplicationRecord, DocumentRecord, ExtractedJob, UsageSummary } from '@/types';
import { sendMessage, sendTabMessage, errorMessage } from '@/lib/messaging';
import { aiStatusFor } from '@/lib/ai/status';
import { findApplicationForUrl } from '@/lib/applications/match';
import { formatTokens, todayUsage } from '@/lib/ai/usage';
import { matchFromAnalysis } from '@/lib/job/match';
import { PasteJobModal, type PastedJobInput } from '@/ui/components/PasteJobModal';
import { Show, Toggle, type MatchCardData } from '@/ui/components';
import { useToast } from '@/ui/components/Toast';
import { useAgent, useApplications, usePageContext, useRuntimeEvents, useSettings, useTheme } from '@/ui/hooks';
import { buildPastedJob } from '@/lib/job/pasted';
import { PopupHeader } from './components/PopupHeader';
import { PopupFooter } from './components/PopupFooter';
import { AiNotice } from './components/AiNotice';
import { ContextCard } from './components/ContextCard';
import type { ContextAction } from './components/ContextActions';
import { AgentStrip } from './components/AgentStrip';
import { BusyBlock } from './components/BusyBlock';
import { FilesCard } from './components/FilesCard';
import { AnswersCard } from './components/AnswersCard';
import { RecentApplicationsCard } from './components/RecentApplicationsCard';

export function PopupApp() {
  const { settings, patch } = useSettings();
  useTheme(settings);
  const { context, tabId, reload: reloadContext } = usePageContext();
  const { agent, action } = useAgent(5000);
  const { applications, reload: reloadApplications } = useApplications();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentsVersion, setDocumentsVersion] = useState(0);
  const [matchResult, setMatchResult] = useState<MatchCardData | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [progressText, setProgressText] = useState('');
  const ai = useMemo(() => aiStatusFor(settings), [settings]);

  const currentApplication = useMemo(() => {
    if (!context) return undefined;
    return findApplicationForUrl(applications, context.url, context.jobTitle, context.company);
  }, [applications, context]);

  const reloadUsage = useCallback(async () => {
    const summary = await sendMessage('ai.usage', undefined).catch(() => null);
    setUsage(summary);
  }, []);

  useEffect(() => {
    void reloadUsage();
  }, [reloadUsage]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!currentApplication) {
        setDocuments([]);
        return;
      }
      const docs = await sendMessage('documents.list', { applicationId: currentApplication.id }).catch(() => []);
      if (!cancelled) setDocuments(docs);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentApplication, documentsVersion]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!context?.url) {
        setMatchResult(null);
        return;
      }
      const { job } = await sendMessage('job.forUrl', { url: context.url, title: context.jobTitle, company: context.company }).catch(() => ({ job: null }));
      if (cancelled) return;
      if (job?.analysis) {
        setMatchResult(matchFromAnalysis(job.analysis));
      } else if (job?.matchScore !== undefined) {
        setMatchResult({ score: job.matchScore, matchedSkills: [], missingSkills: job.missingSkills, reasons: job.matchReasons });
      } else if (currentApplication?.matchScore !== undefined) {
        setMatchResult({ score: currentApplication.matchScore, matchedSkills: [], missingSkills: [], reasons: [] });
      } else {
        setMatchResult(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context?.url, context?.jobTitle, context?.company, currentApplication]);

  useRuntimeEvents((name, data) => {
    if (name === 'pipeline-progress') {
      const message = (data as { message?: string } | undefined)?.message;
      if (message) setProgressText(message);
    }
    if (name === 'applications-changed') {
      void reloadApplications();
    }
  });

  const openOptions = useCallback(async (tab?: string) => {
    await sendMessage('app.openOptions', { tab });
    window.close();
  }, []);

  const run = useCallback(
    async (name: string, task: () => Promise<string | void>) => {
      setBusy(name);
      setProgressText('');
      try {
        const message = await task();
        if (typeof message === 'string' && message) toast.success(message);
        await reloadApplications();
        await reloadContext();
        await reloadUsage();
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setBusy(null);
        setProgressText('');
      }
    },
    [reloadApplications, reloadContext, reloadUsage, toast],
  );

  const extractJob = useCallback(async (): Promise<ExtractedJob | null> => {
    if (tabId === null) return null;
    return (await sendTabMessage(tabId, 'page.extractJob', undefined, { timeout: 20000 })) as ExtractedJob | null;
  }, [tabId]);

  const tailorAndFill = () =>
    run('tailor', async () => {
      const job = await extractJob();
      if (!job) throw new Error('No job posting detected on this page.');
      const probe = await sendTabMessage(tabId as number, 'page.detectForm', undefined, { timeout: 20000 }).catch(() => undefined);
      const questions = probe?.found ? probe.questions : undefined;
      const result = await sendMessage('pipeline.tailor', { job, questions, form: { hasCoverLetterField: probe?.hasCoverLetterField } }, { timeout: 240000 });
      const report = await sendTabMessage(tabId as number, 'page.fillForm', { documentIds: result.documents.map((document) => document.id), answers: result.answers }, { timeout: 120000 });
      return `Documents ready - filled ${report.filled} fields. Review the form, then submit.`;
    });

  const fillOnly = () =>
    run('fill', async () => {
      const report = await sendTabMessage(tabId as number, 'page.fillForm', { documentIds: documents.map((document) => document.id) }, { timeout: 120000 });
      return `Filled ${report.filled} of ${report.total} fields.`;
    });

  const checkMatch = () =>
    run('match', async () => {
      const job = await extractJob();
      if (!job) throw new Error('No job posting detected on this page.');
      const saved = await sendMessage('job.save', { job });
      const match = await sendMessage('job.match', { jobId: saved.id });
      setMatchResult({ score: match.score, reasons: match.reasons, matchedSkills: match.matched, missingSkills: match.missing, recommendation: match.recommendation });
      setMatchOpen(true);
    });

  const queueJob = () =>
    run('queue', async () => {
      const job = await extractJob();
      if (!job) throw new Error('No job posting detected on this page.');
      const state = await sendMessage('agent.enqueue', { jobs: [job] });
      return `Queued. ${state.queue.filter((item) => item.status === 'queued').length} job(s) waiting.`;
    });

  const guideMe = useCallback(async () => {
    if (tabId === null) return;
    try {
      await sendTabMessage(tabId, 'page.openGuide', undefined, { timeout: 10000 });
      window.close();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, [tabId, toast]);

  const submitPasted = useCallback(
    async (input: PastedJobInput, mode: 'tailor' | 'queue') => {
      const job = buildPastedJob(input, context);
      if (tabId !== null) {
        await sendTabMessage(tabId, 'page.setPastedDescription', { text: input.text, title: input.title, company: input.company }, { timeout: 8000 }).catch(() => undefined);
      }
      if (mode === 'queue') {
        const state = await sendMessage('agent.enqueue', { jobs: [job] });
        toast.success(`Queued. ${state.queue.filter((item) => item.status === 'queued').length} job(s) waiting.`);
        return;
      }
      await sendMessage('pipeline.tailor', { job }, { timeout: 240000 });
      toast.success('Documents ready.');
      await reloadApplications();
      await reloadContext();
      await reloadUsage();
    },
    [context, reloadApplications, reloadContext, reloadUsage, tabId, toast],
  );

  const copyAllAnswers = useCallback(async () => {
    const answers = currentApplication?.answers ?? [];
    if (answers.length === 0) return;
    try {
      await navigator.clipboard.writeText(answers.map((answer) => `${answer.question}\n${answer.answer}`).join('\n\n'));
      toast.success('All answers copied.');
    } catch {
      toast.error('Clipboard unavailable.');
    }
  }, [currentApplication, toast]);

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

  const downloadDocument = useCallback(
    (document: DocumentRecord) => {
      void sendMessage('doc.download', { documentId: document.id })
        .then(() => toast.success('Download started'))
        .catch((error) => toast.error(errorMessage(error)));
    },
    [toast],
  );

  const regenerateDocument = useCallback(
    (document: DocumentRecord) => {
      void run('regen', async () => {
        const applicationId = document.applicationId ?? currentApplication?.id;
        if (!applicationId) throw new Error('This file is not linked to an application.');
        await sendMessage('doc.render', { applicationId, kinds: [document.kind] }, { timeout: 240000 });
        setDocumentsVersion((version) => version + 1);
      });
    },
    [currentApplication, run],
  );

  const openApplication = useCallback((application: ApplicationRecord) => void openOptions(`applications/${application.id}`), [openOptions]);

  const actions: ContextAction[] = [
    {
      label: 'Tailor & fill',
      icon: 'sparkles',
      variant: 'primary',
      disabled: !context?.hasJob || !ai.ready,
      title: ai.ready ? 'Tailor documents for this job' : 'Connect an AI provider to enable tailoring',
      loading: busy === 'tailor',
      onSelect: () => void tailorAndFill(),
    },
    {
      label: 'Fill form',
      icon: 'keyboard',
      variant: 'default',
      disabled: !context?.hasApplicationForm,
      loading: busy === 'fill',
      onSelect: () => void fillOnly(),
    },
    {
      label: 'Queue',
      icon: 'robot',
      variant: 'outline',
      disabled: !context?.hasJob,
      title: 'Add this job to the agent queue',
      loading: busy === 'queue',
      onSelect: () => void queueJob(),
    },
    {
      label: 'Select fields',
      icon: 'target',
      variant: context?.hasJob ? 'outline' : 'primary',
      disabled: false,
      title: 'Point JobPal at the job title, company and description yourself',
      onSelect: () => void guideMe(),
    },
    {
      label: 'Paste JD',
      icon: 'paste',
      variant: 'outline',
      disabled: false,
      title: 'Paste a job description when the page has none',
      onSelect: () => setPasteOpen(true),
    },
    {
      label: 'Match',
      icon: 'gauge',
      variant: 'outline',
      disabled: !context?.hasJob || !ai.ready,
      title: ai.ready ? 'Score this job against your profile' : 'Connect an AI provider to enable match scoring',
      loading: busy === 'match',
      onSelect: () => void checkMatch(),
    },
  ];

  const title = context?.jobTitle ?? context?.title ?? 'Open a job posting to get started';
  const meta = context?.company ?? (context?.url ? new URL(context.url).hostname : 'JobPal watches job pages and application forms');
  const tokensToday = usage ? `${formatTokens(todayUsage(usage).totalTokens)}` : '';
  const showAgentProgress = Boolean(agent?.running) && !agent?.currentItem;
  const showAnswers = (currentApplication?.answers ?? []).length > 0;

  return (
    <>
      <div className="popup">
        <PopupHeader onOpenManagement={() => void openOptions('dashboard')} />
        <div className="popup__body">
          <div className="row row--between">
            <Toggle
              checked={settings.ui.showOverlay !== false}
              onChange={(showOverlay) => void patch({ ui: { showOverlay } })}
              label="Page overlay"
              hint="Show the floating JobPal button on web pages."
            />
          </div>
          <Show if={!ai.ready}>
            <AiNotice reason={ai.reason} onConnect={() => void openOptions('ai')} />
          </Show>
          <ContextCard
            context={context}
            title={title}
            meta={meta}
            actions={actions}
            match={matchResult}
            matchOpen={matchOpen}
            onToggleMatch={() => setMatchOpen((value) => !value)}
            onRecalculate={context?.hasJob && ai.ready ? () => void checkMatch() : undefined}
            calculating={busy === 'match'}
          />
          <AgentStrip
            running={Boolean(agent?.running)}
            paused={Boolean(agent?.paused)}
            queued={agent?.queue.filter((item) => item.status === 'queued').length ?? 0}
            appliedToday={agent?.appliedToday ?? 0}
            startDisabled={!ai.ready}
            onStart={() =>
              void action('agent.start')
                .then(() => toast.success('Agent started.'))
                .catch((error) => toast.error(errorMessage(error)))
            }
            onPause={() => void action('agent.pause')}
            onResume={() => void action('agent.resume')}
          />
          <Show if={showAgentProgress}>
            <div className="progress progress--indeterminate">
              <div className="progress__bar" />
            </div>
          </Show>
          <Show if={Boolean(busy)}>
            <BusyBlock
              progressText={progressText}
              onStop={() =>
                void sendMessage('pipeline.cancel', undefined)
                  .then(() => toast.push('Stopping after the current step…'))
                  .catch(() => toast.error('Could not send the stop request.'))
              }
            />
          </Show>
          <FilesCard
            documents={documents}
            onDownload={downloadDocument}
            onRegenerate={regenerateDocument}
            onViewAll={() => void openOptions('documents')}
          />
          <Show if={showAnswers}>
            <AnswersCard
              application={currentApplication as ApplicationRecord}
              onCopyAll={() => void copyAllAnswers()}
              onCopyAnswer={(answer) => void copyAnswer(answer)}
              onView={() => void openOptions(`applications/${currentApplication?.id}`)}
            />
          </Show>
          <RecentApplicationsCard applications={applications} onOpenApplication={openApplication} onViewAll={() => void openOptions('applications')} />
        </div>
        <PopupFooter
          providerName={ai.ready ? (ai.providerName ?? '') : 'no AI connected'}
          tokensToday={tokensToday}
          onUsage={() => void openOptions('ai')}
          onManage={() => void openOptions('dashboard')}
        />
      </div>
      <PasteJobModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        defaultTitle={context?.jobTitle ?? context?.title}
        defaultCompany={context?.company}
        onTailor={(input) => submitPasted(input, 'tailor')}
        onQueue={(input) => submitPasted(input, 'queue')}
      />
    </>
  );
}
