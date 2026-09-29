import type { AgentQueueItem, AgentState, ApplicationQuestion, ExtractedJob, ID } from '@/types';
import { storageLocalGet, storageLocalSet, tabsCreate, tabsQuery, tabSendMessage, notificationsCreate } from '@/lib/browser';
import { getSettings, getDefaultProfile, getProfiles } from '@/lib/storage';
import { getApplication, listApplications, saveApplication } from '@/lib/db';
import { tailorForJob } from './pipeline';
import { evaluateRules, shouldAutoSubmit, withinWorkingHours } from './rules';
import { notify, notifyNeedsAttention } from './notify';
import { requireAIConnection } from './ai-router';
import { aiStatusFor } from '@/lib/ai/status';
import { sleep, randomBetween, uid } from '@/lib/utils';

const AGENT_KEY = 'jobpal.agent';
export const AGENT_ALARM = 'jobpal.agent.tick';

export function defaultAgentState(): AgentState {
  return {
    running: false,
    paused: false,
    mode: 'assist',
    appliedToday: 0,
    queue: [],
    log: [],
    stats: { applied: 0, skipped: 0, failed: 0, needsAttention: 0 },
  };
}

export async function getAgentState(): Promise<AgentState> {
  const stored = await storageLocalGet<AgentState>([AGENT_KEY]);
  const state = stored[AGENT_KEY];
  if (!state) return defaultAgentState();
  const today = new Date().toDateString();
  const lastRun = state.lastRunAt ? new Date(state.lastRunAt).toDateString() : '';
  return { ...defaultAgentState(), ...state, appliedToday: lastRun === today ? state.appliedToday : 0 };
}

export async function setAgentState(patch: Partial<AgentState>): Promise<AgentState> {
  const current = await getAgentState();
  const next = { ...current, ...patch, lastRunAt: Date.now() };
  await storageLocalSet({ [AGENT_KEY]: next });
  return next;
}

export function agentLog(state: AgentState, level: 'info' | 'warn' | 'error' | 'success', message: string): AgentState['log'] {
  return [{ at: Date.now(), level, message }, ...state.log].slice(0, 120);
}

export async function agentStart(mode: 'assist' | 'auto' = 'assist'): Promise<AgentState> {
  const settings = await getSettings();
  requireAIConnection(settings);
  const state = await getAgentState();
  const next = await setAgentState({
    ...state,
    running: true,
    paused: false,
    mode,
    log: agentLog(state, 'info', `Agent started in ${mode} mode.`),
  });
  await chrome.alarms.create(AGENT_ALARM, { periodInMinutes: 1 });
  if (settings.automation.notifyOnIssue) {
    await notify('JobPal agent started', mode === 'auto' ? 'Working through your queue automatically.' : 'Assist mode: forms will be filled for your review.', 'info');
  }
  void processNextItem();
  return next;
}

export async function agentStop(): Promise<AgentState> {
  const state = await getAgentState();
  const next = await setAgentState({ ...state, running: false, paused: false, currentItem: undefined, log: agentLog(state, 'info', 'Agent stopped.') });
  await chrome.alarms.clear(AGENT_ALARM);
  return next;
}

export async function agentPause(reason?: string): Promise<AgentState> {
  const state = await getAgentState();
  return setAgentState({ ...state, paused: true, log: agentLog(state, 'warn', reason ? `Paused: ${reason}` : 'Paused by user.') });
}

export async function agentResume(): Promise<AgentState> {
  const state = await getAgentState();
  const next = await setAgentState({ ...state, paused: false, running: true, log: agentLog(state, 'info', 'Resumed.') });
  void processNextItem();
  return next;
}

export async function agentEnqueue(jobs: ExtractedJob[]): Promise<AgentState> {
  const state = await getAgentState();
  const existingUrls = new Set(state.queue.map((item) => item.url));
  const applications = await listApplications();
  const appliedUrls = new Set(applications.map((application) => application.jobUrl));
  const additions: AgentQueueItem[] = jobs
    .filter((job) => !existingUrls.has(job.url) && !appliedUrls.has(job.url))
    .map((job) => ({
      id: uid('queue'),
      url: job.url,
      title: job.title,
      company: job.company,
      site: job.site,
      status: 'queued',
      addedAt: Date.now(),
    }));
  return setAgentState({
    ...state,
    queue: [...state.queue, ...additions],
    log: agentLog(state, 'info', `Queued ${additions.length} job${additions.length === 1 ? '' : 's'}.`),
  });
}

export async function agentClearQueue(): Promise<AgentState> {
  const state = await getAgentState();
  const remaining = state.queue.filter((item) => item.status === 'processing');
  return setAgentState({ ...state, queue: remaining, log: agentLog(state, 'info', 'Queue cleared.') });
}

export async function processNextItem(): Promise<void> {
  const settings = await getSettings();
  if (!settings.automation.enabled && !settings.automation.huntEnabled) {
    const state = await getAgentState();
    if (state.running) await agentPause('Automation is disabled in settings.');
    return;
  }
  const ai = aiStatusFor(settings);
  if (!ai.ready) {
    const state = await getAgentState();
    if (state.running) await agentPause(`AI required — ${ai.reason ?? 'connect an AI provider'}.`);
    return;
  }
  let state = await getAgentState();
  if (!state.running || state.paused) return;
  if (!withinWorkingHours(settings.automation)) {
    state = await setAgentState({ ...state, log: agentLog(state, 'info', 'Outside working hours — waiting.') });
    return;
  }
  if (state.appliedToday >= settings.automation.dailyLimit) {
    const next = await setAgentState({ ...state, paused: true, log: agentLog(state, 'warn', `Daily limit of ${settings.automation.dailyLimit} applications reached.`) });
    if (settings.automation.notifyOnIssue) await notifyNeedsAttention('Daily limit reached', `JobPal applied to ${next.appliedToday} jobs today.`);
    return;
  }
  const item = state.queue.find((queueItem) => queueItem.status === 'queued');
  if (!item) {
    await chrome.alarms.create(AGENT_ALARM, { periodInMinutes: 1 });
    return;
  }

  state = await setAgentState({
    ...state,
    currentItem: { ...item, status: 'processing' },
    queue: state.queue.map((queueItem) => (queueItem.id === item.id ? { ...queueItem, status: 'processing' } : queueItem)),
    log: agentLog(state, 'info', `Processing ${item.title || item.url}`),
  });

  try {
    await processItem(item, settings.automation.mode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state = await getAgentState();
    await setAgentState({
      ...state,
      running: true,
      paused: true,
      currentItem: undefined,
      queue: state.queue.map((queueItem) => (queueItem.id === item.id ? { ...queueItem, status: 'failed', reason: message } : queueItem)),
      stats: { ...state.stats, failed: state.stats.failed + 1 },
      log: agentLog(state, 'error', `Failed: ${item.title || item.url} — ${message}. Agent paused; retry when you are ready.`),
    });
    if (settings.automation.notifyOnIssue) {
      await notifyNeedsAttention('Application failed — agent paused', `${item.title || item.url}\n${message}\nOpen the Automation tab to retry.`);
    }
  }

  const after = await getAgentState();
  if (after.running && !after.paused) {
    const delaySeconds = settings.automation.rules['human-like-pacing']?.enabled === false ? 5 : randomBetween(settings.automation.minDelaySeconds, settings.automation.maxDelaySeconds);
    await chrome.alarms.create(AGENT_ALARM, { periodInMinutes: 1 });
    setTimeout(() => void processNextItem(), Math.min(delaySeconds, 20) * 1000);
  }
}

export async function agentRetryItem(id: ID): Promise<AgentState> {
  const settings = await getSettings();
  requireAIConnection(settings);
  const state = await getAgentState();
  const target = state.queue.find((item) => item.id === id);
  const next = await setAgentState({
    ...state,
    running: true,
    paused: false,
    queue: state.queue.map((item) => (item.id === id ? { ...item, status: 'queued', reason: undefined } : item)),
    log: agentLog(state, 'info', `Retrying ${target?.title || target?.url || 'job'}.`),
  });
  await chrome.alarms.create(AGENT_ALARM, { periodInMinutes: 1 });
  void processNextItem();
  return next;
}

export async function agentRemoveItem(id: ID): Promise<AgentState> {
  const state = await getAgentState();
  return setAgentState({ ...state, queue: state.queue.filter((item) => item.id !== id) });
}

async function processItem(item: AgentQueueItem, mode: 'assist' | 'auto'): Promise<void> {
  const settings = await getSettings();
  const tab = await tabsCreate({ url: item.url, active: false });
  const tabId = tab.id;
  if (tabId === undefined) throw new Error('Could not open a tab for this job');
  try {
    await waitForTabReady(tabId);
    const job = await extractJobWithRetry(tabId);
    if (!job) throw new Error('Could not read the job description from this page.');

    const profiles = await getProfiles();
    const profile = await getDefaultProfile();
    void profiles;
    const applications = await listApplications();

    const formProbe = await tabSendMessage<{ ok: boolean; data?: { found: boolean; questions: ApplicationQuestion[]; hasCoverLetterField?: boolean } }>(tabId, {
      type: 'page.detectForm',
      payload: undefined,
    }).catch(() => undefined);
    const detected = formProbe?.data;

    const result = await tailorForJob(job, { source: 'agent', questions: detected?.questions, form: { hasCoverLetterField: detected?.hasCoverLetterField } });
    const evaluation = evaluateRules({ job, analysis: result.analysis, settings: settings.automation, profile, applications });

    if (!evaluation.allowed) {
      const state = await getAgentState();
      await setAgentState({
        ...state,
        currentItem: undefined,
        queue: state.queue.map((queueItem) => (queueItem.id === item.id ? { ...queueItem, status: 'skipped', reason: evaluation.blockers[0], matchScore: result.analysis.matchScore } : queueItem)),
        stats: { ...state.stats, skipped: state.stats.skipped + 1 },
        log: agentLog(state, 'warn', `Skipped ${job.title}: ${evaluation.blockers[0]}`),
      });
      await chrome.tabs.remove(tabId);
      return;
    }

    await tabSendMessage(tabId, { type: 'page.openOverlayPanel', payload: undefined }).catch(() => undefined);

    if (!detected?.found) {
      const state = await getAgentState();
      await setAgentState({
        ...state,
        currentItem: undefined,
        queue: state.queue.map((queueItem) => (queueItem.id === item.id ? { ...queueItem, status: 'needs-attention', reason: 'Application form not detected — open this link and apply manually.' } : queueItem)),
        stats: { ...state.stats, needsAttention: state.stats.needsAttention + 1 },
        log: agentLog(state, 'warn', `No form detected for ${job.title}.`),
      });
      await focusTab(tabId);
      await notifyNeedsAttention('Form not detected', `${job.title} at ${job.company} — the application form could not be detected.`);
      return;
    }

    const fill = await tabSendMessage<{ ok: boolean; data?: { filled: number; total: number; fields: { confidence: number }[] } }>(tabId, {
      type: 'page.fillForm',
      payload: { documentIds: result.documents.map((document) => document.id) },
    });
    const fields = fill?.data?.fields ?? [];
    const confidence = fields.length > 0 ? fields.reduce((acc, field) => acc + field.confidence, 0) / fields.length : 0;
    const host = safeHost(job.url);
    const decision = shouldAutoSubmit(settings.automation, {
      confidence,
      blockers: evaluation.blockers,
      host,
    });

    if (decision.submit && mode === 'auto') {
      const submit = await tabSendMessage<{ ok: boolean; data?: { submitted: boolean; reason?: string } }>(tabId, {
        type: 'page.submitForm',
        payload: undefined,
      });
      if (submit?.data?.submitted) {
        const application = await getApplication(result.application.id);
        if (application) {
          await saveApplication({
            ...application,
            status: 'applied',
            autoSubmitted: true,
            appliedAt: Date.now(),
            timeline: [...application.timeline, { at: Date.now(), label: 'Submitted automatically by the JobPal agent' }],
            updatedAt: Date.now(),
          });
        }
        const state = await getAgentState();
        await setAgentState({
          ...state,
          currentItem: undefined,
          appliedToday: state.appliedToday + 1,
          queue: state.queue.map((queueItem) => (queueItem.id === item.id ? { ...queueItem, status: 'done', matchScore: result.analysis.matchScore } : queueItem)),
          stats: { ...state.stats, applied: state.stats.applied + 1 },
          log: agentLog(state, 'success', `Applied to ${job.title} at ${job.company}.`),
        });
        await notify('Application submitted', `${job.title} at ${job.company}.`, 'success');
        await chrome.tabs.remove(tabId);
        return;
      }
    }

    const application = await getApplication(result.application.id);
    if (application) {
      await saveApplication({
        ...application,
        status: 'ready',
        needsAttention: decision.submit ? undefined : decision.reason,
        timeline: [...application.timeline, { at: Date.now(), label: decision.submit ? 'Filled automatically' : `Ready for review — ${decision.reason}` }],
        updatedAt: Date.now(),
      });
    }
    const state = await getAgentState();
    await setAgentState({
      ...state,
      currentItem: undefined,
      queue: state.queue.map((queueItem) => (queueItem.id === item.id ? { ...queueItem, status: 'needs-attention', reason: decision.reason, matchScore: result.analysis.matchScore } : queueItem)),
      stats: { ...state.stats, needsAttention: state.stats.needsAttention + 1 },
      log: agentLog(state, 'info', `Filled ${fill?.data?.filled ?? 0}/${fill?.data?.total ?? 0} fields for ${job.title}. ${decision.reason}`),
    });
    await focusTab(tabId);
    if (settings.automation.notifyOnIssue) {
      await notifyNeedsAttention('Ready for your review', `${job.title} at ${job.company} — ${decision.reason}`);
    }
  } catch (error) {
    await chrome.tabs.remove(tabId).catch(() => undefined);
    throw error;
  }
}

async function focusTab(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
  } catch {
    /* tab may already be closed */
  }
}

async function waitForTabReady(tabId: number, timeoutMs = 30000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') {
      await sleep(1200);
      return;
    }
    await sleep(400);
  }
  throw new Error('The job page took too long to load.');
}

async function extractJobWithRetry(tabId: number, attempts = 3): Promise<ExtractedJob | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await tabSendMessage<{ ok: boolean; data?: ExtractedJob | null }>(tabId, { type: 'page.extractJob', payload: undefined });
      if (response?.data) return response.data;
    } catch {
      /* content script may still be booting */
    }
    await sleep(1500);
  }
  return null;
}

export async function applyToCurrentTab(
  tabId: number,
  options: { autoSubmit?: boolean; questions?: ApplicationQuestion[] } = {},
): Promise<{ applicationId?: ID; status: string; message: string }> {
  const job = await tabSendMessage<{ ok: boolean; data?: ExtractedJob | null }>(tabId, { type: 'page.extractJob', payload: undefined });
  if (!job?.data) return { status: 'error', message: 'No job posting detected on this page.' };
  const settings = await getSettings();
  const profile = await getDefaultProfile();
  const applications = await listApplications();
  const result = await tailorForJob(job.data, { source: 'manual', questions: options.questions });
  const evaluation = evaluateRules({ job: job.data, analysis: result.analysis, settings: settings.automation, profile, applications });
  const form = await tabSendMessage<{ ok: boolean; data?: { found: boolean; questions: ApplicationQuestion[] } }>(tabId, { type: 'page.detectForm', payload: undefined }).catch(() => undefined);
  if (!form?.data?.found) {
    return {
      applicationId: result.application.id,
      status: 'ready',
      message: `Documents generated (${result.documents.length}). No application form detected on this page — open the employer's form and use "Fill this page".`,
    };
  }
  const fill = await tabSendMessage<{ ok: boolean; data?: { filled: number; total: number; fields: { confidence: number }[] } }>(tabId, {
    type: 'page.fillForm',
    payload: { documentIds: result.documents.map((document) => document.id) },
  });
  const fields = fill?.data?.fields ?? [];
  const confidence = fields.length > 0 ? fields.reduce((acc, field) => acc + field.confidence, 0) / fields.length : 0;
  const host = safeHost(job.data.url);
  const decision = options.autoSubmit
    ? shouldAutoSubmit({ ...settings.automation, mode: 'auto', autoSubmit: true }, { confidence, blockers: evaluation.blockers, host })
    : { submit: false, reason: 'Manual apply — review the form and submit when ready.' };

  if (decision.submit) {
    const submit = await tabSendMessage<{ ok: boolean; data?: { submitted: boolean; reason?: string } }>(tabId, { type: 'page.submitForm', payload: undefined });
    if (submit?.data?.submitted) {
      const application = await getApplication(result.application.id);
      if (application) {
        await saveApplication({
          ...application,
          status: 'applied',
          autoSubmitted: true,
          appliedAt: Date.now(),
          timeline: [...application.timeline, { at: Date.now(), label: 'Submitted automatically' }],
          updatedAt: Date.now(),
        });
      }
      const state = await getAgentState();
      await setAgentState({ ...state, appliedToday: state.appliedToday + 1 });
      return { applicationId: result.application.id, status: 'applied', message: `Application submitted. ${result.documents.length} documents archived.` };
    }
  }

  return {
    applicationId: result.application.id,
    status: 'ready',
    message: `Filled ${fill?.data?.filled ?? 0} of ${fill?.data?.total ?? 0} fields. ${decision.reason}`,
  };
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function agentResetDaily(): Promise<void> {
  const state = await getAgentState();
  await setAgentState({ ...state, appliedToday: 0 });
}

export async function findSearchTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await tabsQuery({});
  return tabs.find((tab) => tab.url && /linkedin\.com\/jobs\/search|indeed\.com\/jobs\?|glassdoor\..*\/Job\/.*jobs/.test(tab.url)) ?? null;
}

export async function resetAgentForTests(): Promise<void> {
  await storageLocalSet({ [AGENT_KEY]: defaultAgentState() });
  await notificationsCreate({ type: 'basic', title: 'JobPal', message: 'Agent state reset', iconUrl: chrome.runtime.getURL('icons/icon128.png') });
}
