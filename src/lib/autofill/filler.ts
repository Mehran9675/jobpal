import type { AutofillSettings } from '@/types';
import type { FieldKey } from './fields';
import { scanFields, type ScannedField } from './form-scan';
import { normalizeWhitespace } from '@/lib/utils';

export interface FillOutcome {
  label: string;
  key: FieldKey;
  confidence: number;
  value: string;
  status: 'filled' | 'skipped' | 'no-value' | 'error';
  error?: string;
}

export interface FillReport {
  total: number;
  filled: number;
  skipped: number;
  outcomes: FillOutcome[];
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

function highlight(element: HTMLElement): void {
  const previous = element.style.boxShadow;
  element.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.85)';
  element.style.transition = 'box-shadow 240ms ease';
  setTimeout(() => {
    element.style.boxShadow = previous;
  }, 2200);
}

function optionScore(optionLabel: string, optionValue: string, desired: string): number {
  const target = desired.toLowerCase().trim();
  const label = optionLabel.toLowerCase().trim();
  const value = optionValue.toLowerCase().trim();
  if (!target) return 0;
  if (label === target || value === target) return 100;
  if (label.includes(target) || target.includes(label)) return 80;
  if (value.includes(target) || target.includes(value)) return 70;
  const words = target.split(/\s+/).filter((word) => word.length > 2);
  const hits = words.filter((word) => label.includes(word) || value.includes(word)).length;
  return words.length > 0 ? (hits / words.length) * 60 : 0;
}

function fillSelect(field: ScannedField, desired: string): boolean {
  const select = field.element as HTMLSelectElement;
  const candidates = field.options.filter((option) => !/^\s*(--|select|choose|please)/i.test(option.label) && option.value !== '');
  let best: { option: HTMLOptionElement; score: number } | null = null;
  for (const option of select.options) {
    const score = optionScore(option.label, option.value, desired);
    if (score > 30 && (!best || score > best.score)) best = { option, score };
  }
  void candidates;
  if (!best) return false;
  select.value = best.option.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  select.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

function choiceGroupFor(element: HTMLElement): HTMLElement | null {
  return element.closest('fieldset, [role="radiogroup"], [class*="question" i], [class*="field" i], div');
}

export function fillChoiceGroups(
  root: ParentNode,
  values: Record<string, string>,
  classify: (label: string) => { key: FieldKey; confidence: number },
  settings: AutofillSettings,
): FillOutcome[] {
  const outcomes: FillOutcome[] = [];
  const groups = new Map<string, HTMLInputElement[]>();
  for (const input of root.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]')) {
    const key = input.name || `${input.getAttribute('data-group') ?? ''}`;
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(input);
    groups.set(key, list);
  }

  for (const [name, inputs] of groups) {
    if (inputs.length === 0) continue;
    const group = choiceGroupFor(inputs[0]);
    const groupLabel = normalizeWhitespace(
      group?.querySelector('legend, [class*="question" i], [class*="label" i], label')?.textContent ?? inputs[0].getAttribute('aria-label') ?? name,
    ).slice(0, 200);
    const { key, confidence } = classify(groupLabel);
    if (key === 'unknown' || confidence < 0.4) continue;
    if (confidence < 0.6 && !settings.fillSensitive) continue;
    const desired = values[key];
    if (!desired) {
      outcomes.push({ label: groupLabel || name, key, confidence, value: '', status: 'no-value' });
      continue;
    }
    let matched = false;
    for (const input of inputs) {
      if (input.disabled || input.readOnly) continue;
      const labelText = normalizeWhitespace(
        input.labels?.[0]?.textContent ?? input.closest('label')?.textContent ?? input.value ?? '',
      );
      const score = optionScore(labelText, input.value, desired);
      if (score >= 80 || confidence >= 0.85) {
        if (input.checked && !settings.overwriteExisting) {
          matched = true;
          break;
        }
        input.click();
        if (settings.highlightFilled) highlight(input);
        matched = true;
        break;
      }
    }
    outcomes.push({ label: groupLabel || name, key, confidence, value: desired, status: matched ? 'filled' : 'skipped' });
  }
  return outcomes;
}

export function fillTextFields(
  root: ParentNode,
  values: Record<string, string>,
  settings: AutofillSettings,
  overrides: { minConfidence?: number } = {},
): FillReport {
  const minConfidence = overrides.minConfidence ?? 0.45;
  const fields = scanFields(root).filter((field) => field.visible);
  const outcomes: FillOutcome[] = [];

  for (const field of fields) {
    const value = values[field.key];
    if (field.key === 'unknown' || field.confidence < minConfidence) {
      outcomes.push({ label: field.label, key: field.key, confidence: field.confidence, value: '', status: 'skipped' });
      continue;
    }
    if (!value) {
      outcomes.push({ label: field.label, key: field.key, confidence: field.confidence, value: '', status: 'no-value' });
      continue;
    }
    const existing = field.element instanceof HTMLSelectElement ? field.element.value : field.element.value;
    if (existing && !settings.overwriteExisting) {
      outcomes.push({ label: field.label, key: field.key, confidence: field.confidence, value: '', status: 'skipped', error: 'already filled' });
      continue;
    }
    try {
      if (field.element instanceof HTMLSelectElement) {
        const ok = fillSelect(field, value);
        outcomes.push({ label: field.label, key: field.key, confidence: field.confidence, value, status: ok ? 'filled' : 'skipped' });
      } else {
        setNativeValue(field.element, value);
        if (settings.highlightFilled) highlight(field.element);
        outcomes.push({ label: field.label, key: field.key, confidence: field.confidence, value, status: 'filled' });
      }
    } catch (error) {
      outcomes.push({
        label: field.label,
        key: field.key,
        confidence: field.confidence,
        value,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const total = outcomes.length;
  const filled = outcomes.filter((outcome) => outcome.status === 'filled').length;
  return { total, filled, skipped: total - filled, outcomes };
}

export async function attachFileInput(input: HTMLInputElement, blob: Blob, filename: string): Promise<boolean> {
  try {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    return true;
  } catch (error) {
    console.warn('[jobpaal] file attach failed', error);
    return false;
  }
}

export function fillAnswerFields(root: ParentNode, answers: { label: string; answer: string }[]): FillOutcome[] {
  const fields = scanFields(root).filter((field) => field.visible && (field.element instanceof HTMLTextAreaElement || field.type === 'text'));
  const outcomes: FillOutcome[] = [];
  for (const answer of answers) {
    const cleaned = normalizeWhitespace(answer.label).toLowerCase();
    const match = fields.find((field) => {
      const label = normalizeWhitespace(field.label).toLowerCase();
      return label === cleaned || label.includes(cleaned) || cleaned.includes(label);
    });
    if (!match) continue;
    if (match.element.value && match.element.value.length > 5) continue;
    setNativeValue(match.element as HTMLInputElement | HTMLTextAreaElement, answer.answer);
    highlight(match.element);
    outcomes.push({ label: match.label, key: match.key, confidence: match.confidence, value: answer.answer, status: 'filled' });
  }
  return outcomes;
}

export function describeField(field: ScannedField): string {
  return `${field.label || field.name || field.type} (${field.key}, ${Math.round(field.confidence * 100)}%)`;
}
