import type { AnswerRecord, ExtractedJob, ID, PageContext } from '@/types';
import { getProfiles, getSettings } from '@/lib/storage';
import { attachFileInput, fillAnswerFields, fillChoiceGroups, fillTextFields, findNextButton, findSubmitButton, type FillOutcome } from '@/lib/autofill/filler';
import { buildFieldValues, classifyField, type FieldKey } from '@/lib/autofill/fields';
import { detectQuestions, hasApplicationForm, resolveLabel, scanFields } from '@/lib/autofill/form-scan';
import { detectPageSite, adapterForUrl, extractJobFromDocument, extractJobSearchCards, extractLinkedInProfile, seemsLikeJobPosting } from '@/lib/job/sites';
import { metaContent } from '@/lib/job/readability';
import { applyRecipe, clearRecipe, elementSelector, getRecipe, hostOf, readSelector, saveRecipe, type AnswerTarget, type FileTarget, type FormMapping, type JobSelectors } from '@/lib/job/recipes';
import { startPicking, PICK_LABELS, type PickTarget } from './picker';
import { sendMessage } from '@/lib/messaging';
import { keywordFrequency, normalizeWhitespace, sleep } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Manual guidance state                                               */
/* ------------------------------------------------------------------ */

const sessionPicks = new Map<Exclude<PickTarget, 'formField' | 'answer' | 'file'>, { value: string; selector: string }>();
const sessionMappings = new Map<string, FormMapping>();
const sessionAnswerTargets = new Map<string, { selector: string; answer: string; label: string }>();
const sessionFileTargets = new Map<string, { selector: string; label: string }>();
let pastedDescription: { text: string; title: string; company: string } = { text: '', title: '', company: '' };

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

export async function pickJobField(target: Exclude<PickTarget, 'formField' | 'answer' | 'file'>): Promise<{ target: string; label: string; value: string; selector: string } | null> {
  const picked = await startPicking(target, elementSelector);
  if (!picked) return null;
  const value = picked.value.slice(0, 4000);
  sessionPicks.set(target, { value, selector: picked.selector });
  return { target, label: PICK_LABELS[target], value, selector: picked.selector };
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

/* ------------------- pasted job description ----------------------- */

export function setPastedDescription(text: string, title = '', company = ''): void {
  pastedDescription = { text: text.trim(), title: title.trim(), company: company.trim() };
}

export function getPastedDescription(): { text: string; title: string; company: string } {
  return pastedDescription;
}

/* ------------------- answer / file destinations ------------------- */

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
    throw new Error('That element cannot hold text — pick a text input, textarea or editable field.');
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
    console.warn('[jobpal] attach failed', error);
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

  const pick = (target: Exclude<PickTarget, 'formField' | 'answer' | 'file'>) => sessionPicks.get(target)?.value;
  const title = pick('title') ?? pastedDescription.title ?? fromRecipe?.title ?? '';
  const description = pastedDescription.text || pick('description') || fromRecipe?.description || '';
  const company = pick('company') ?? pastedDescription.company ?? fromRecipe?.company ?? '';
  const location_ = pick('location') ?? fromRecipe?.location;
  const salary = pick('salary') ?? fromRecipe?.salary;

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

/** Auto detection first, then the user's saved recipe, then session picks. */
export async function extractJobResolved(): Promise<ExtractedJob | null> {
  const auto = extractJob();
  const manual = await manualJob();
  if (!manual) return auto;
  if (!auto) return manual;
  const manualTitle = manual.title && manual.title !== document.title ? manual.title : undefined;
  const manualCompany = manual.company && manual.company !== hostOf(location.href) ? manual.company : undefined;
  const useManualDescription = manual.description.length >= 120;
  return {
    ...auto,
    title: manualTitle ?? auto.title,
    company: manualCompany ?? auto.company,
    location: manual.location ?? auto.location,
    salary: manual.salary ?? auto.salary,
    description: useManualDescription ? manual.description : auto.description || manual.description,
    remote: manual.remote ?? auto.remote,
    keywords: manual.keywords.length > 0 ? manual.keywords : auto.keywords,
  };
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
        error: attached ? undefined : 'Could not attach the file — download it and attach manually.',
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

  if (payload.documentIds && payload.documentIds.length > 0) {
    let effectiveIds = payload.documentIds;
    if (settings.document.fileSource === 'uploaded') {
      const lookup = await sendMessage('documents.forUrl', { url: location.href }).catch(() => null);
      const uploaded = lookup?.uploaded ?? [];
      if (uploaded.length > 0) effectiveIds = uploaded.map((document) => document.id);
    }
    await attachDocuments(effectiveIds, settings.autofill.highlightFilled);
  }

  outcomes.push(...textReport.outcomes, ...choiceOutcomes, ...answerOutcomes);
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
      console.warn('[jobpal] could not attach document', documentId, error);
    }
  }
}

const SUCCESS_PATTERNS = /(thank you for applying|application (was )?(submitted|received|sent)|we('| ha)ve received your|successfully applied|application complete|thanks for your interest)/i;

export async function submitForm(): Promise<{ submitted: boolean; reason?: string }> {
  const button = findSubmitButton(document);
  if (!button) return { submitted: false, reason: 'No submit button found — finish this application manually.' };
  const beforeUrl = location.href;
  button.scrollIntoView({ block: 'center' });
  await sleep(300);
  button.click();
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(700);
    const text = (document.body?.innerText ?? '').slice(0, 8000);
    if (location.href !== beforeUrl && !/login|sign ?in|register/i.test(location.pathname)) return { submitted: true };
    if (SUCCESS_PATTERNS.test(text)) return { submitted: true };
  }
  return { submitted: true };
}

export async function advanceStep(): Promise<{ advanced: boolean; step: number; label?: string }> {
  const button = findNextButton(document);
  if (!button) return { advanced: false, step: 0, label: 'No next button found' };
  const label = normalizeWhitespace(button.textContent ?? '');
  button.click();
  await sleep(900);
  const step = document.querySelectorAll('[data-automation-id="progressBar"] li, .artdeco-completeness-meter__step, ol li[aria-current]').length;
  return { advanced: true, step, label };
}

export function collectFormSnapshot(): { fields: { selector: string; label: string; type: string; value: string }[]; questions: ReturnType<typeof detectQuestions> } {
  const fields = scanFields(document)
    .filter((field) => field.visible)
    .map((field) => ({
      selector: field.id ? `#${field.id}` : field.name ? `[name="${field.name}"]` : field.type,
      label: field.label,
      type: field.type,
      value: (field.element.value ?? '').slice(0, 400),
    }));
  return { fields, questions: detectQuestions(document) };
}
