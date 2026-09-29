import type { DocumentRecord, ExtractedJob } from '@/types';
import { sendMessage, errorMessage } from '@/lib/messaging';
import { getSettings } from '@/lib/storage';
import { aiStatusFor } from '@/lib/ai/status';
import { formatTokens } from '@/lib/ai/usage';
import { matchFromAnalysis } from '@/lib/job/match';
import { canonicalize } from '@/lib/job/sites';
import { openDocumentViewer as openViewer } from '@/lib/viewer';
import {
  buildContext,
  detectForm,
  extractJob,
  fillForm,
  forgetRecipe,
  getMappings,
  getPastedDescription,
  getPicks,
  getRecipePicks,
  hasRecipe,
  manualJob,
  persistRecipe,
  pickAnswerTarget,
  pickFileTarget,
  pickFormField,
  pickJobField,
  scanLinkedInProfile,
  setMapping,
  setPastedDescription,
} from '../actions';
import { getOverlayState, patchOverlay } from './store';
import { DOC_FUNCTIONS, type GuideTarget } from './constants';

/* ------------------------------------------------------------------ */
/* Small state helpers                                                 */
/* ------------------------------------------------------------------ */

export function setStatus(message: string, tone: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  patchOverlay({ status: message, statusTone: tone });
}

export function setBusy(busy: boolean): void {
  patchOverlay({ busy });
}

/** Live status from the background pipeline (analysing, writing, answering…). */
export function setProgress(message: string): void {
  const state = getOverlayState();
  if (!state.panelOpen || !message) return;
  patchOverlay({ status: message, statusTone: 'info' });
}

export function setGuideOpen(open: boolean): void {
  patchOverlay({ guideOpen: open, panelOpen: true });
}

export function closeAllMenus(): void {
  patchOverlay({ openDocMenu: undefined });
}

export function openDocumentViewer(documentId: string): void {
  openViewer(documentId);
}

async function withBusy<T>(message: string, task: () => Promise<T>): Promise<T | undefined> {
  setBusy(true);
  setStatus(message);
  try {
    const result = await task();
    setBusy(false);
    return result;
  } catch (error) {
    setBusy(false);
    setStatus(errorMessage(error), 'error');
    return undefined;
  }
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Data loading                                                        */
/* ------------------------------------------------------------------ */

export async function loadUsage(): Promise<void> {
  try {
    const summary = await sendMessage('ai.usage', undefined, { timeout: 15000 });
    patchOverlay({
      tokensToday: summary.byDay[new Date().toISOString().slice(0, 10)]?.totalTokens ?? 0,
      tokensTotal: summary.total.totalTokens,
    });
  } catch {
    /* usage is informational */
  }
}

export async function loadMatch(): Promise<void> {
  const state = getOverlayState();
  try {
    const { job } = await sendMessage('job.forUrl', { url: location.href, title: state.job?.title, company: state.job?.company }, { timeout: 15000 });
    if (job?.analysis) {
      patchOverlay({ match: matchFromAnalysis(job.analysis) });
    } else if (job?.matchScore !== undefined) {
      patchOverlay({
        match: {
          score: job.matchScore,
          reasons: job.matchReasons ?? [],
          matchedSkills: [],
          missingSkills: job.missingSkills ?? [],
          recommendation: job.matchScore >= 80 ? 'strong_match' : job.matchScore >= 65 ? 'good_match' : job.matchScore >= 45 ? 'stretch' : 'weak_match',
        },
      });
    }
  } catch {
    /* keep the previous value */
  }
}

export async function loadDocuments(): Promise<void> {
  patchOverlay({ filesLoading: true });
  try {
    const state = getOverlayState();
    const result = await sendMessage(
      'documents.forUrl',
      { url: location.href, title: state.job?.title, company: state.job?.company },
      { timeout: 15000 },
    );
    if (result.documents.length > 0 || result.answers.length > 0 || result.applicationId) {
      patchOverlay({
        documents: result.documents,
        answers: result.answers ?? [],
        applicationId: result.applicationId ?? state.applicationId,
      });
    } else if (state.applicationId) {
      const documents = await sendMessage('documents.list', { applicationId: state.applicationId }).catch(() => null);
      if (documents) patchOverlay({ documents });
    }
    patchOverlay({ uploaded: result.uploaded ?? state.uploaded });
  } catch {
    /* keep the previous files */
  } finally {
    patchOverlay({ filesLoading: false });
  }
}

export async function refreshContext(job?: ExtractedJob | null): Promise<void> {
  const previousJob = getOverlayState().job;
  const context = buildContext();

  let aiReady = false;
  let aiReason: string | undefined;
  let fileSource: 'generated' | 'uploaded' = 'generated';
  try {
    const settings = await getSettings();
    const ai = aiStatusFor(settings);
    aiReady = ai.ready;
    aiReason = ai.reason;
    fileSource = settings.document.fileSource;
  } catch {
    aiReady = false;
  }

  let nextJob: ExtractedJob | null = job ?? previousJob;
  if (job === undefined) nextJob = context.hasJob ? extractJob() : null;

  if (nextJob) {
    const previousCanonical = previousJob ? canonicalize(previousJob.canonicalUrl || previousJob.url) : '';
    const nextCanonical = canonicalize(nextJob.canonicalUrl || nextJob.url);
    if (previousCanonical && nextCanonical && previousCanonical !== nextCanonical) {
      patchOverlay({ documents: [], answers: [], applicationId: undefined, match: null, matchOpen: false });
    }
  } else if (previousJob && sameOrigin(previousJob.url, location.href)) {
    // SPA switched to an apply/section route without a new posting: keep context.
    nextJob = previousJob;
  }

  if (!nextJob) nextJob = await manualJob().catch(() => null);

  patchOverlay({
    context,
    job: nextJob,
    aiReady,
    aiReason,
    fileSource,
    picks: { ...(await getRecipePicks().catch(() => ({}))), ...getPicks() },
    pastedText: getPastedDescription().text,
    mappings: await getMappings().catch(() => []),
    recipeSaved: await hasRecipe().catch(() => false),
  });

  await loadMatch();
  await loadDocuments();
  await loadUsage();
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export async function runTailorAndFill(): Promise<void> {
  await withBusy('Reading the posting and generating documents…', async () => {
    const state = getOverlayState();
    const job = state.job ?? extractJob();
    if (!job) {
      setStatus('Nothing to tailor yet — use “Guide me” to pick the fields or paste the job description.', 'warn');
      return;
    }
    const probe = detectForm();
    const result = await sendMessage(
      'pipeline.tailor',
      { job, questions: probe.found ? probe.questions : undefined, form: { hasCoverLetterField: probe.hasCoverLetterField } },
      { timeout: 180000 },
    );
    patchOverlay({ documents: result.documents, answers: result.answers ?? [] });
    setStatus('Documents ready. Filling the form…', 'success');
    await runFill(result.documents.map((document) => document.id), result.answers);
  });
}

export async function runFill(
  documentIds?: string[],
  answers?: { question: string; answer: string; required?: boolean }[],
): Promise<void> {
  await withBusy('Filling your details…', async () => {
    const report = await fillForm({ documentIds, answers });
    const tone = report.filled > 0 ? 'success' : 'warn';
    const hint = report.skipped > 0 ? ' Some fields could not be matched — use “Send to field” below, or copy the answers and download the files.' : '';
    setStatus(`Filled ${report.filled} of ${report.total} fields.${hint}`, tone);
  });
}

export async function runAnalyze(): Promise<void> {
  await withBusy('Scoring the match against your profile…', async () => {
    const state = getOverlayState();
    const job = state.job ?? extractJob();
    if (!job) {
      setStatus('No job detected on this page.', 'warn');
      return;
    }
    const saved = await sendMessage('job.save', { job });
    const match = await sendMessage('job.match', { jobId: saved.id });
    patchOverlay({
      match: {
        score: match.score,
        reasons: match.reasons,
        matchedSkills: match.matched,
        missingSkills: match.missing,
        recommendation: match.recommendation,
      },
      matchOpen: true,
      status: '',
      statusTone: 'info',
    });
  });
}

export async function runQueue(): Promise<void> {
  await withBusy('Adding this job to the agent queue…', async () => {
    const state = getOverlayState();
    const job = state.job ?? extractJob();
    if (!job) {
      setStatus('No job detected on this page.', 'warn');
      return;
    }
    const agent = await sendMessage('agent.enqueue', { jobs: [job] });
    setStatus(`Queued. ${agent.queue.filter((item) => item.status === 'queued').length} job(s) waiting for the agent.`, 'success');
  });
}

export async function runOpen(): Promise<void> {
  const state = getOverlayState();
  if (state.context.site === 'linkedin-profile') {
    await withBusy('Scanning your LinkedIn profile…', async () => {
      const profile = scanLinkedInProfile();
      await chrome.storage.local.set({ 'jobpal.pendingProfile': { profile, at: Date.now() } });
      setStatus(`Captured ${profile.experience?.length ?? 0} roles and ${profile.skills?.flatMap((group) => group.items).length ?? 0} skills. Opening the management page…`, 'success');
      await sendMessage('app.openOptions', { tab: 'profile' });
    });
    return;
  }
  await sendMessage('app.openOptions', { tab: 'dashboard' });
}

export async function runPasteDescription(text: string): Promise<void> {
  const trimmed = text.trim();
  setPastedDescription(trimmed);
  const job = await manualJob().catch(() => null);
  patchOverlay({
    pastedText: trimmed,
    job: job ?? getOverlayState().job,
    picks: { ...(await getRecipePicks().catch(() => ({}))), ...getPicks() },
  });
  setStatus(trimmed ? 'Job description saved — JobPal will use it exactly like a scraped one.' : 'Pasted description cleared.', trimmed ? 'success' : 'info');
}

export async function runPick(target: GuideTarget): Promise<void> {
  patchOverlay({ picking: true });
  setStatus(`Click the element containing the ${target}…`, 'info');
  try {
    const result = await pickJobField(target);
    if (!result) {
      setStatus('Selection cancelled.', 'warn');
      return;
    }
    const job = await manualJob().catch(() => null);
    patchOverlay({
      picks: getPicks(),
      job: job ?? getOverlayState().job,
      status: `Captured ${result.label}: “${result.value.slice(0, 80)}”.`,
      statusTone: 'success',
    });
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  } finally {
    patchOverlay({ picking: false });
  }
}

export async function runMapField(): Promise<void> {
  patchOverlay({ picking: true });
  setStatus('Click the form field you want to map…', 'info');
  try {
    const result = await pickFormField();
    if (!result) {
      setStatus('Selection cancelled.', 'warn');
      return;
    }
    patchOverlay({
      mappings: await getMappings(),
      status: `Mapped “${result.label}” to ${result.key}. Change it below if needed.`,
      statusTone: 'success',
    });
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  } finally {
    patchOverlay({ picking: false });
  }
}

export function applyMapping(selector: string, key: string, label?: string): void {
  setMapping(selector, key as never, label);
  patchOverlay({ mappings: getOverlayState().mappings.map((item) => (item.selector === selector ? { ...item, key } : item)) });
}

export async function runSaveRecipe(): Promise<void> {
  await withBusy('Saving this site’s recipe…', async () => {
    const result = await persistRecipe();
    patchOverlay({ recipeSaved: result.saved });
    setStatus(result.saved ? `Saved. JobPal will detect this layout automatically on ${result.host}.` : 'Could not save a recipe for this page.', result.saved ? 'success' : 'warn');
  });
}

export async function runForgetRecipe(): Promise<void> {
  await withBusy('Forgetting this site…', async () => {
    await forgetRecipe();
    patchOverlay({ picks: {}, mappings: [], recipeSaved: false });
    setStatus('Recipe and manual selections cleared for this site.', 'info');
  });
}

export async function runPickAnswer(question: string, answer: string): Promise<void> {
  patchOverlay({ picking: true });
  setStatus('Click the field where this answer should go…', 'info');
  try {
    const result = await pickAnswerTarget(question, answer);
    if (!result) {
      setStatus('Selection cancelled.', 'warn');
      return;
    }
    setStatus(`Answer placed in “${result.label}”.`, 'success');
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  } finally {
    patchOverlay({ picking: false });
  }
}

export async function runPickFile(documentId: string, kind: string): Promise<void> {
  patchOverlay({ picking: true });
  setStatus('Click the upload field this file belongs in…', 'info');
  try {
    const result = await pickFileTarget(documentId, kind);
    if (!result) {
      setStatus('Selection cancelled.', 'warn');
      return;
    }
    setStatus(
      result.attached ? 'File attached — JobPal will fill it automatically next time.' : 'Field remembered, but attaching failed. Download the file and attach it manually.',
      result.attached ? 'success' : 'warn',
    );
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  } finally {
    patchOverlay({ picking: false });
  }
}

export async function regenerateKind(kind: string): Promise<void> {
  const state = getOverlayState();
  const label = DOC_FUNCTIONS.find((entry) => entry.kind === kind)?.label ?? kind.replace('_', ' ');
  if (!state.aiReady) {
    setStatus('Connect an AI provider first — regeneration needs AI.', 'warn');
    return;
  }
  await withBusy(`Regenerating ${label.toLowerCase()} with your current design…`, async () => {
    const applicationId = getOverlayState().applicationId;
    if (!applicationId) {
      await runTailorAndFill();
      return;
    }
    await sendMessage('doc.render', { applicationId, kinds: [kind] }, { timeout: 240000 });
    await loadDocuments();
    setStatus(`${label} regenerated with your current design and profile.`, 'success');
  });
}

export async function regenerateAllDocuments(): Promise<void> {
  const state = getOverlayState();
  if (!state.aiReady) {
    setStatus('Connect an AI provider first — regeneration needs AI.', 'warn');
    return;
  }
  const applicationId = state.applicationId;
  if (!applicationId) {
    setStatus('Nothing to regenerate yet — generate the documents first.', 'warn');
    return;
  }
  await withBusy('Regenerating every document…', async () => {
    await sendMessage('pipeline.regenerate', { applicationId }, { timeout: 300000 });
    await loadDocuments();
    setStatus('All documents regenerated with your current design and profile.', 'success');
  });
}

export async function copyText(text: string, message: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(message, 'success');
  } catch {
    setStatus('Clipboard unavailable — select the text and copy it manually.', 'warn');
  }
}

export async function stopGeneration(): Promise<void> {
  try {
    await sendMessage('pipeline.cancel', undefined, { timeout: 10000 });
    setStatus('Stopping after the current step…', 'warn');
  } catch {
    setStatus('Could not send the stop request.', 'warn');
  }
}

export async function openAllDocuments(refresh = false): Promise<void> {
  const state = getOverlayState();
  patchOverlay({ view: 'documents', allDocsLoading: true, allDocuments: refresh ? state.allDocuments : [] });
  try {
    const documents = await sendMessage('documents.list', undefined, { timeout: 15000 });
    patchOverlay({ allDocuments: documents });
  } catch {
    patchOverlay({ allDocuments: [] });
  }
  patchOverlay({ allDocsLoading: false });
}

export function closeDocumentsPage(): void {
  patchOverlay({ view: 'main' });
}

export async function downloadDocument(documentId: string): Promise<void> {
  try {
    await sendMessage('doc.download', { documentId });
    setStatus('Download started.', 'success');
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  }
}

export async function attachDocument(documentId: string): Promise<void> {
  try {
    const file = await sendMessage('doc.getBlob', { documentId });
    const binary = atob(file.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: file.mime });
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')].filter((input) => input.offsetParent !== null);
    const target = inputs.find((input) => /resume|cv/i.test(`${input.name} ${input.id}`)) ?? inputs[0];
    if (!target) {
      setStatus('No file upload field found on this page.', 'warn');
      return;
    }
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([blob], file.filename, { type: file.mime }));
    target.files = dataTransfer.files;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    setStatus(`Attached ${file.filename}.`, 'success');
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  }
}

export function usageLabel(): string {
  const state = getOverlayState();
  return `${state.tokensToday > 0 ? formatTokens(state.tokensToday) : '0'} tokens today · ${formatTokens(state.tokensTotal)} all-time`;
}

export type { DocumentRecord };
