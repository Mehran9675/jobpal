import type { AnswerRecord, ExtractedJob, ID, JobRecord, PageContext } from '@/types';
import { getProfiles, getSettings, patchSettings } from '@/lib/storage';
import { attachFileInput, fillAnswerFields, fillChoiceGroups, fillTextFields, type FillOutcome } from '@/lib/autofill/filler';
import { buildFieldValues, classifyField, type FieldKey } from '@/lib/autofill/fields';
import { detectQuestions, hasApplicationForm, resolveLabel, scanFields } from '@/lib/autofill/form-scan';
import { detectPageSite, adapterForUrl, extractJobFromDocument, extractJobSearchCards, extractLinkedInProfile, seemsLikeJobPosting } from '@/lib/job/sites';
import { metaContent } from '@/lib/job/readability';
import { applyRecipe, clearRecipe, elementSelector, getRecipe, hostOf, readSelector, saveRecipe, type AnswerTarget, type FileTarget, type FormMapping, type JobSelectors } from '@/lib/job/recipes';
import { cancelPicking, startPicking, PICK_LABELS, type JobPickTarget } from './picker';
import { sendMessage } from '@/lib/messaging';
import { keywordFrequency, normalizeWhitespace, sleep, uid } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Manual guidance state                                               */
/* ------------------------------------------------------------------ */

const sessionPicks = new Map<JobPickTarget, { value: string; selector: string }>();
const sessionMappings = new Map<string, FormMapping>();
const sessionAnswerTargets = new Map<string, { selector: string; answer: string; label: string }>();
const sessionFileTargets = new Map<string, { selector: string; label: string }>();
const pastedFields = new Map<JobPickTarget, string>();

export function buildContext(): PageContext {
  const site = detectPageSite(location.href, document);
  const job = detectJobQuick();
  return {
    url: location.href,
    title: document.title,
    site,
    hasJob: Boolean(job),
    hasApplicationForm: hasApplicationForm(document),
    jobTitle: job?.title,
    company: job?.company,
    easyApply: job?.easyApply,
  };
}

function detectJobQuick(): Partial<ExtractedJob> | null {
  const title = metaContent(document, ['og:title']) ?? document.querySelector('h1')?.textContent ?? document.title;
  if (!title) return null;
  if (!seemsLikeJobPosting(document, location.href)) return null;
  const company = metaContent(document, ['og:site_name']);
  return { title: normalizeWhitespace(title), company: company ? normalizeWhitespace(company) : undefined };
}

export function extractJob(): ExtractedJob | null {
  return extractJobFromDocument(document, location.href);
}

export function scanLinkedInProfile() {
  return extractLinkedInProfile(document);
}

export function scanJobListings(): ExtractedJob[] {
  const site = detectPageSite(location.href, document);
  return extractJobSearchCards(document, site === 'linkedin-profile' || site === 'other' ? 'generic' : site);
}

export function detectForm(): { found: boolean; fields: number; questions: ReturnType<typeof detectQuestions>; hasCoverLetterField: boolean } {
  const found = hasApplicationForm(document);
  if (!found) return { found, fields: 0, questions: [], hasCoverLetterField: false };
  const fields = scanFields(document);
  const questions = detectQuestions(document);
  const hasCoverLetterField = fields.some((field) => field.key === 'coverLetter' || field.key === 'coverLetterFile') || questions.some((question) => /cover\s*letter/i.test(question.label));
  return { found, fields: fields.length, questions, hasCoverLetterField };
}

/* ------------------------------------------------------------------ */
/* Manual picking & recipes                                            */
/* ------------------------------------------------------------------ */

export interface PickedJobField {
  target: JobPickTarget;
  label: string;
  value: string;
  selector: string;
}

const pendingJobPicks = new Map<string, (result: PickedJobField | null) => void>();

/** Called by the overlay in the top frame. Broadcasts the picker to every frame. */
export async function pickJobField(target: JobPickTarget): Promise<PickedJobField | null> {
  const token = uid('pick');
  const result = await new Promise<PickedJobField | null>((resolve) => {
    pendingJobPicks.set(token, resolve);
    void sendMessage('frame.pickBroadcast', { token, target }).catch(() => {
      if (pendingJobPicks.delete(token)) resolve(null);
    });
    setTimeout(() => {
      if (pendingJobPicks.delete(token)) resolve(null);
    }, 45000);
  });
  if (!result) return null;
  const value = result.value.slice(0, 4000);
  sessionPicks.set(target, { value, selector: result.selector });
  return { target, label: PICK_LABELS[target], value, selector: result.selector };
}

/** Runs the picker in whichever frame the background broadcast reached. */
export async function startFrameJobPick(token: string, target: JobPickTarget): Promise<void> {
  // Frames without a body (or without a picker) must stay silent: the first
  // reported result wins, so an empty frame cannot cancel the pick.
  if (!document.body) return;
  cancelPicking();
  const picked = await startPicking(target, elementSelector);
  if (picked) {
    await sendMessage('frame.pickResult', {
      token,
      result: { target, label: PICK_LABELS[target], value: picked.value.slice(0, 4000), selector: picked.selector },
    }).catch(() => undefined);
    return;
  }
  // A null here is either Escape or a stop broadcast; stopped picks stay quiet.
  if (stoppedPickTokens.has(token)) return;
  await sendMessage('frame.pickResult', { token, result: null }).catch(() => undefined);
}

const stoppedPickTokens = new Set<string>();

export function stopFrameJobPick(token: string): void {
  stoppedPickTokens.add(token);
  if (stoppedPickTokens.size > 64) stoppedPickTokens.clear();
  cancelPicking();
}

/** Called in the top frame when the background relays the winning pick. */
export function resolveFramePick(token: string, result: PickedJobField | null): void {
  const resolve = pendingJobPicks.get(token);
  if (!resolve) return;
  pendingJobPicks.delete(token);
  resolve(result);
}

export function getPicks(): Record<string, { value: string; selector: string }> {
  return Object.fromEntries(sessionPicks.entries());
}

export async function pickFormField(): Promise<{ selector: string; label: string; key: FieldKey; confidence: number } | null> {
  const picked = await startPicking('formField', elementSelector);
  if (!picked) return null;
  const element = picked.element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const label = resolveLabel(element) || picked.label;
  const classification = classifyField({
    label,
    name: element.getAttribute('name') ?? '',
    id: element.getAttribute('id') ?? '',
    placeholder: element.getAttribute('placeholder') ?? '',
    autocomplete: element.getAttribute('autocomplete') ?? '',
    type: (element.getAttribute('type') ?? element.tagName.toLowerCase()).toLowerCase(),
    ariaLabel: element.getAttribute('aria-label') ?? '',
  });
  sessionMappings.set(picked.selector, { selector: picked.selector, key: classification.key, label });
  return { selector: picked.selector, label, key: classification.key, confidence: classification.confidence };
}

export async function getMappings(): Promise<FormMapping[]> {
  const recipe = await getRecipe(hostOf(location.href));
  const merged = new Map<string, FormMapping>();
  for (const mapping of recipe?.formFields ?? []) merged.set(mapping.selector, mapping);
  for (const [selector, mapping] of sessionMappings.entries()) merged.set(selector, mapping);
  return [...merged.values()];
}

export function setMapping(selector: string, key: FieldKey, label?: string): void {
  const existing = sessionMappings.get(selector);
  sessionMappings.set(selector, { selector, key, label: label ?? existing?.label });
}

/* ----------------------- pasted job fields ------------------------ */

/** Any guide field can be filled in by hand instead of by picking. */
export function setPastedField(target: JobPickTarget, value: string): void {
  const trimmed = value.trim();
  if (trimmed) pastedFields.set(target, trimmed);
  else pastedFields.delete(target);
}

export function getPastedFields(): Record<string, string> {
  return Object.fromEntries(pastedFields.entries());
}

/** Kept for the popup and side panel paste form. */
export function setPastedDescription(text: string, title = '', company = ''): void {
  setPastedField('description', text);
  setPastedField('title', title);
  setPastedField('company', company);
}

export function getPastedDescription(): { text: string; title: string; company: string } {
  return {
    text: pastedFields.get('description') ?? '',
    title: pastedFields.get('title') ?? '',
    company: pastedFields.get('company') ?? '',
  };
}

/* ------------------- answer / file destinations ------------------- */

/** The standing answers bank: questions the user added by hand. */
export async function getBankEntries(): Promise<{ id: ID; question: string; answer: string }[]> {
  const settings = await getSettings();
  return settings.autofill.answersBank.map((entry) => ({ id: entry.id, question: entry.question, answer: entry.answer }));
}

export async function saveBankEntry(question: string, answer: string): Promise<{ id: ID; question: string; answer: string }> {
  const trimmedQuestion = question.trim();
  const trimmedAnswer = answer.trim();
  if (!trimmedQuestion || !trimmedAnswer) throw new Error('Both the question and the answer are needed.');
  const settings = await getSettings();
  const existing = settings.autofill.answersBank.find((entry) => entry.question.toLowerCase() === trimmedQuestion.toLowerCase());
  const entry = { id: existing?.id ?? uid('bank'), question: trimmedQuestion, answer: trimmedAnswer, tags: existing?.tags ?? [] };
  const bank = [...settings.autofill.answersBank.filter((item) => item.id !== entry.id), entry];
  await patchSettings({ autofill: { answersBank: bank } });
  return { id: entry.id, question: entry.question, answer: entry.answer };
}

export async function removeBankEntry(id: ID): Promise<void> {
  const settings = await getSettings();
  await patchSettings({ autofill: { answersBank: settings.autofill.answersBank.filter((entry) => entry.id !== id) } });
}

function isFillableElement(element: HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) return element.type !== 'file' && element.type !== 'hidden' && element.type !== 'submit' && element.type !== 'button';
  return element.isContentEditable;
}

function isFileElement(element: HTMLElement): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.type === 'file';
}

function setElementValue(element: HTMLElement, value: string): void {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    return;
  }
  element.textContent = value;
  element.dispatchEvent(new InputEvent('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function pickAnswerTarget(question: string, answer: string): Promise<{ selector: string; label: string } | null> {
  const picked = await startPicking('answer', elementSelector);
  if (!picked) return null;
  if (!isFillableElement(picked.element)) {
    throw new Error('That element cannot hold text - pick a text input, textarea or editable field.');
  }
  const label = resolveLabel(picked.element) || picked.label;
  sessionAnswerTargets.set(question, { selector: picked.selector, answer, label });
  setElementValue(picked.element, answer);
  picked.element.style.outline = '2px solid rgba(34, 197, 94, 0.9)';
  setTimeout(() => (picked.element.style.outline = ''), 2200);
  return { selector: picked.selector, label };
}

export async function pickFileTarget(documentId: ID, kind: string): Promise<{ selector: string; label: string; attached: boolean } | null> {
  const picked = await startPicking('file', elementSelector);
  if (!picked) return null;
  if (!isFileElement(picked.element)) {
    throw new Error('Pick a file upload input (an element like “Attach resume”).');
  }
  const label = resolveLabel(picked.element) || picked.label;
  const attached = await attachDocumentTo(picked.element, documentId);
  sessionFileTargets.set(kind, { selector: picked.selector, label });
  return { selector: picked.selector, label, attached };
}

async function attachDocumentTo(input: HTMLInputElement, documentId: ID): Promise<boolean> {
  try {
    const file = await sendMessage('doc.getBlob', { documentId });
    const binary = atob(file.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: file.mime });
    await attachFileInput(input, blob, file.filename);
    input.style.outline = '2px solid rgba(34, 197, 94, 0.9)';
    setTimeout(() => (input.style.outline = ''), 2200);
    return true;
  } catch (error) {
    console.warn('[jobpaal] attach failed', error);
    return false;
  }
}

export async function getAnswerTargets(): Promise<AnswerTarget[]> {
  const recipe = await getRecipe(hostOf(location.href));
  const merged = new Map<string, AnswerTarget>();
  for (const target of recipe?.answerTargets ?? []) merged.set(target.question, target);
  for (const [question, value] of sessionAnswerTargets.entries()) {
    merged.set(question, { question, selector: value.selector, answer: value.answer });
  }
  return [...merged.values()];
}

export async function getFileTargets(): Promise<FileTarget[]> {
  const recipe = await getRecipe(hostOf(location.href));
  const merged = new Map<string, FileTarget>();
  for (const target of recipe?.fileTargets ?? []) merged.set(target.kind, target);
  for (const [kind, value] of sessionFileTargets.entries()) merged.set(kind, { kind, selector: value.selector });
  return [...merged.values()];
}

export async function persistRecipe(): Promise<{ saved: boolean; host: string }> {
  const host = hostOf(location.href);
  if (!host) return { saved: false, host };
  const existing = await getRecipe(host);
  const job: JobSelectors = { ...(existing?.job ?? {}) };
  for (const [target, pick] of sessionPicks.entries()) {
    // Selectors picked inside a frame only resolve in that frame's document,
    // so a recipe can only remember picks that match the top document.
    if (!pick.selector) continue;
    try {
      if (!document.querySelector(pick.selector)) continue;
    } catch {
      continue;
    }
    job[target] = pick.selector;
  }
  const mappings = await getMappings();
  const answerTargets = await getAnswerTargets();
  const fileTargets = await getFileTargets();
  await saveRecipe({
    host,
    job,
    formFields: mappings,
    answerTargets: answerTargets.length > 0 ? answerTargets : existing?.answerTargets,
    fileTargets: fileTargets.length > 0 ? fileTargets : existing?.fileTargets,
    updatedAt: Date.now(),
  });
  return { saved: true, host };
}

export async function forgetRecipe(): Promise<void> {
  sessionPicks.clear();
  sessionMappings.clear();
  sessionAnswerTargets.clear();
  sessionFileTargets.clear();
  await clearRecipe(hostOf(location.href));
}

export async function manualJob(): Promise<ExtractedJob | null> {
  const url = location.href;
  const host = hostOf(url);
  const recipe = await getRecipe(host);
  const fromRecipe = recipe && Object.keys(recipe.job ?? {}).length > 0 ? applyRecipe(document, recipe, url) : null;

  const pick = (target: JobPickTarget) => sessionPicks.get(target)?.value;
  const pasted = (target: JobPickTarget) => pastedFields.get(target);
  const title = pick('title') || pasted('title') || fromRecipe?.title || '';
  const description = pasted('description') || pick('description') || fromRecipe?.description || '';
  const company = pick('company') || pasted('company') || fromRecipe?.company || '';
  const location_ = pick('location') || pasted('location') || fromRecipe?.location;
  const salary = pick('salary') || pasted('salary') || fromRecipe?.salary;

  if (!title && !description) return null;
  const keywords = description ? keywordFrequency(description, 25).map((entry) => entry.term) : [];
  return {
    url,
    canonicalUrl: url,
    site: adapterForUrl(url).id,
    title: title || document.title || 'Target role',
    company: company || host,
    location: location_,
    salary,
    description,
    remote: /remote|anywhere|distributed/i.test(`${location_ ?? ''} ${title}`),
    requirements: [],
    keywords,
    easyApply: /easy apply|quick apply/i.test(document.body?.innerText?.slice(0, 12000) ?? ''),
  };
}

export type JobSource = 'page' | 'stored' | 'manual' | 'none';

let sessionJob: ExtractedJob | null = null;
let lastResolution: { source: JobSource; words: number } | null = null;
let lastJob: ExtractedJob | null = null;

function rememberResolution(job: ExtractedJob | null, source: JobSource): ExtractedJob | null {
  lastJob = job;
  lastResolution = { source: job ? source : 'none', words: wordCount(job?.description) };
  return job;
}

function wordCount(text: string | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function storedRecordToExtracted(job: JobRecord): ExtractedJob {
  return {
    url: job.url,
    canonicalUrl: job.canonicalUrl,
    site: job.site,
    title: job.title,
    company: job.company,
    location: job.location,
    remote: job.remote,
    employmentType: job.employmentType,
    salary: job.salary,
    description: job.description,
    requirements: job.requirements,
    keywords: job.keywords,
    postedAt: job.postedAt,
  };
}

/** Reuses a job description JobPaal already scraped for this posting (any tab, any site). */
async function fetchStoredJob(title?: string, company?: string): Promise<ExtractedJob | null> {
  try {
    const { job } = await sendMessage('job.forUrl', { url: location.href, title, company }, { timeout: 15000 });
    return job ? storedRecordToExtracted(job) : null;
  } catch {
    return null;
  }
}

/**
 * The description used for tailoring: the most complete one available, no
 * matter which tab (description or application form) or site it came from.
 */
export async function extractJobResolved(): Promise<ExtractedJob | null> {
  if (sessionJob) return rememberResolution(sessionJob, 'stored');

  const auto = extractJob();
  const manual = await manualJob();
  const stored = await fetchStoredJob(manual?.title || auto?.title, manual?.company || auto?.company);

  const candidates: { job: ExtractedJob; source: Exclude<JobSource, 'none'>; description: string }[] = [];
  if (manual) candidates.push({ job: manual, source: 'manual', description: manual.description ?? '' });
  if (auto) candidates.push({ job: auto, source: 'page', description: auto.description ?? '' });
  if (stored) candidates.push({ job: stored, source: 'stored', description: stored.description ?? '' });
  if (candidates.length === 0) return rememberResolution(null, 'none');

  const best = [...candidates].sort((a, b) => b.description.length - a.description.length)[0];
  const base = candidates.find((candidate) => candidate.source === 'page') ?? candidates.find((candidate) => candidate.source === 'manual') ?? candidates[0];
  const useBestDescription = best.description.length >= 120;

  const job: ExtractedJob = {
    ...base.job,
    description: useBestDescription ? best.description : base.description,
    title: base.job.title || best.job.title,
    company: base.job.company || best.job.company,
    location: base.job.location ?? best.job.location,
    salary: base.job.salary ?? best.job.salary,
    remote: base.job.remote ?? best.job.remote,
    keywords: base.job.keywords.length > 0 ? base.job.keywords : best.job.keywords,
    requirements: base.job.requirements.length > 0 ? base.job.requirements : best.job.requirements,
  };
  return rememberResolution(job, useBestDescription ? best.source : base.source);
}

export async function getJobStatus(): Promise<{ source: JobSource; words: number; title: string; company: string; hasDescription: boolean }> {
  // Always re-resolve: a manual pick or a pasted description must be reflected.
  await extractJobResolved();
  const resolution = lastResolution ?? { source: 'none' as JobSource, words: 0 };
  return {
    source: resolution.source,
    words: resolution.words,
    title: lastJob?.title ?? '',
    company: lastJob?.company ?? '',
    hasDescription: resolution.words >= 20,
  };
}

/** Explicitly use a job JobPaal stored earlier (covers description-on-one-site forms). */
export async function useStoredJob(jobId: string): Promise<boolean> {
  try {
    const { job } = await sendMessage('job.get', { jobId }, { timeout: 15000 });
    if (!job) return false;
    sessionJob = storedRecordToExtracted(job);
    rememberResolution(sessionJob, 'stored');
    return true;
  } catch {
    return false;
  }
}

export function clearStoredJob(): void {
  sessionJob = null;
  lastResolution = null;
  lastJob = null;
}

/** Recipe selections with their current values, so the guide can show what is remembered. */
export async function getRecipePicks(): Promise<Record<string, { value: string; selector: string }>> {
  const recipe = await getRecipe(hostOf(location.href));
  if (!recipe) return {};
  const out: Record<string, { value: string; selector: string }> = {};
  for (const [target, selector] of Object.entries(recipe.job ?? {})) {
    if (!selector) continue;
    const value = readSelector(document, selector, target === 'description' ? 'block' : 'text') ?? '';
    out[target] = { value: value.slice(0, 4000), selector };
  }
  return out;
}

export async function hasRecipe(): Promise<boolean> {
  const recipe = await getRecipe(hostOf(location.href));
  return Boolean(recipe && (Object.keys(recipe.job ?? {}).length > 0 || (recipe.formFields?.length ?? 0) > 0));
}

/* ------------------------------------------------------------------ */
/* Autofill                                                            */
/* ------------------------------------------------------------------ */

export interface FillPayload {
  documentIds?: ID[];
  answers?: AnswerRecord[];
}

export async function fillForm(payload: FillPayload = {}): Promise<{ filled: number; skipped: number; total: number; fields: { label: string; key: string; confidence: number }[] }> {
  const [settings, profiles] = await Promise.all([getSettings(), getProfiles()]);
  const profile = profiles.find((item) => item.isDefault) ?? profiles[0];
  const coverLetterAnswer = payload.answers?.find((answer) => /cover\s*letter|why (do you|are you)/i.test(answer.question))?.answer ?? '';
  const values = buildFieldValues(profile, settings.autofill, { coverLetter: coverLetterAnswer });

  const outcomes: FillOutcome[] = [];

  // User-taught field mappings win over heuristics.
  const mappings = await getMappings();
  for (const mapping of mappings) {
    let element: HTMLElement | null = null;
    try {
      element = document.querySelector(mapping.selector);
    } catch {
      element = null;
    }
    const value = values[mapping.key];
    if (!element || !value) continue;
    const field = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const existing = 'value' in field ? field.value : '';
    if (existing && !settings.autofill.overwriteExisting) continue;
    try {
      if (field instanceof HTMLSelectElement) {
        const option = [...field.options].find((candidate) => candidate.label.toLowerCase().includes(String(value).toLowerCase()) || candidate.value.toLowerCase() === String(value).toLowerCase());
        if (option) {
          field.value = option.value;
          field.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (setter) setter.call(field, value);
        else field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        field.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      }
      if (settings.autofill.highlightFilled) {
        field.style.outline = '2px solid rgba(34, 197, 94, 0.9)';
        setTimeout(() => (field.style.outline = ''), 2200);
      }
      outcomes.push({ label: mapping.label || mapping.selector, key: mapping.key, confidence: 1, value, status: 'filled' });
    } catch (error) {
      outcomes.push({ label: mapping.label || mapping.selector, key: mapping.key, confidence: 1, value, status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Answers the user explicitly assigned to specific fields.
  const answerTargets = await getAnswerTargets();
  const answersByQuestion = new Map((payload.answers ?? []).map((answer) => [answer.question, answer.answer]));
  for (const target of answerTargets) {
    let element: HTMLElement | null = null;
    try {
      element = document.querySelector(target.selector);
    } catch {
      element = null;
    }
    const text = answersByQuestion.get(target.question) ?? target.answer ?? '';
    if (!element || !text) continue;
    const field = element as HTMLInputElement | HTMLTextAreaElement;
    if (field.value && !settings.autofill.overwriteExisting) continue;
    try {
      setElementValue(element, text);
      if (settings.autofill.highlightFilled) {
        element.style.outline = '2px solid rgba(34, 197, 94, 0.9)';
        setTimeout(() => (element!.style.outline = ''), 2200);
      }
      outcomes.push({ label: `Answer: ${target.question.slice(0, 60)}`, key: 'unknown', confidence: 1, value: text, status: 'filled' });
    } catch (error) {
      outcomes.push({ label: `Answer: ${target.question.slice(0, 60)}`, key: 'unknown', confidence: 1, value: text, status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Files the user explicitly assigned to specific upload inputs.
  const fileTargets = await getFileTargets();
  if (fileTargets.length > 0) {
    const lookup = await sendMessage('documents.forUrl', { url: location.href }).catch(() => null);
    for (const target of fileTargets) {
      let input: HTMLInputElement | null = null;
      try {
        input = document.querySelector(target.selector) as HTMLInputElement | null;
      } catch {
        input = null;
      }
      if (!input || input.type !== 'file') continue;
      const document_ = [...(lookup?.documents ?? [])].sort((a, b) => b.createdAt - a.createdAt).find((entry) => entry.kind === target.kind);
      if (!document_) continue;
      const attached = await attachDocumentTo(input, document_.id);
      outcomes.push({
        label: `Attach ${document_.filename}`,
        key: 'unknown',
        confidence: 1,
        value: document_.filename,
        status: attached ? 'filled' : 'error',
        error: attached ? undefined : 'Could not attach the file - download it and attach manually.',
      });
    }
  }

  const textReport = fillTextFields(document, values, settings.autofill);
  const choiceOutcomes = fillChoiceGroups(document, values, (label) => classifyField({ label }), settings.autofill);
  const answerOutcomes =
    payload.answers && settings.autofill.enabled
      ? fillAnswerFields(
          document,
          payload.answers.map((answer) => ({ label: answer.question, answer: answer.answer })),
        )
      : [];
  // Questions the user added by hand (answers bank), for fields detection missed.
  const bankOutcomes =
    settings.autofill.enabled && settings.autofill.answersBank.length > 0
      ? fillAnswerFields(
          document,
          settings.autofill.answersBank.map((entry) => ({ label: entry.question, answer: entry.answer })),
        )
      : [];

  if (payload.documentIds && payload.documentIds.length > 0) {
    let effectiveIds = payload.documentIds;
    if (settings.document.fileSource === 'uploaded') {
      const lookup = await sendMessage('documents.forUrl', { url: location.href }).catch(() => null);
      const uploaded = lookup?.uploaded ?? [];
      if (uploaded.length > 0) effectiveIds = uploaded.map((document) => document.id);
    }
    await attachDocuments(effectiveIds, settings.autofill.highlightFilled);
  }

  outcomes.push(...textReport.outcomes, ...choiceOutcomes, ...answerOutcomes, ...bankOutcomes);
  const filled = outcomes.filter((outcome) => outcome.status === 'filled').length;
  return {
    filled,
    skipped: Math.max(0, outcomes.length - filled),
    total: outcomes.length,
    fields: outcomes.map((outcome: FillOutcome) => ({ label: outcome.label.slice(0, 120), key: outcome.key, confidence: Math.round(outcome.confidence * 100) / 100 })),
  };
}

async function attachDocuments(documentIds: ID[], highlight: boolean): Promise<void> {
  const fileInputs = [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')];
  if (fileInputs.length === 0) return;
  for (const documentId of documentIds) {
    try {
      const file = await sendMessage('doc.getBlob', { documentId });
      const binary = atob(file.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: file.mime });
      const preferred = file.kind === 'cover_letter' ? /cover/i : /resume|cv/i;
      const input =
        fileInputs.find((candidate) => preferred.test(`${candidate.name} ${candidate.id} ${candidate.getAttribute('aria-label') ?? ''}`)) ??
        fileInputs.find((candidate) => !candidate.files || candidate.files.length === 0) ??
        fileInputs[0];
      if (!input) continue;
      await attachFileInput(input, blob, file.filename);
      if (highlight) {
        input.style.outline = '2px solid rgba(99, 102, 241, 0.85)';
        setTimeout(() => (input.style.outline = ''), 2200);
      }
      await sleep(400);
    } catch (error) {
      console.warn('[jobpaal] could not attach document', documentId, error);
    }
  }
}
