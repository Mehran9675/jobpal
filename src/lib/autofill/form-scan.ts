import type { ApplicationQuestion } from '@/types';
import { classifyField, labelForField, type FieldKey } from './fields';
import { normalizeWhitespace, uid } from '@/lib/utils';

export interface ScannedField {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  label: string;
  key: FieldKey;
  confidence: number;
  type: string;
  name: string;
  id: string;
  required: boolean;
  visible: boolean;
  options: { value: string; label: string }[];
  maxLength?: number;
}

function visible(element: Element): boolean {
  const html = element as HTMLElement;
  if (html.offsetParent === null && getComputedStyle(html).position !== 'fixed') return false;
  const style = getComputedStyle(html);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
}

export function resolveLabel(element: HTMLElement): string {
  const id = element.getAttribute('id');
  if (id) {
    const explicit = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
    if (explicit) return normalizeWhitespace(explicit.textContent ?? '');
  }
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const text = ariaLabelledBy
      .split(/\s+/)
      .map((idPart) => document.getElementById(idPart)?.textContent ?? '')
      .join(' ');
    if (normalizeWhitespace(text)) return normalizeWhitespace(text);
  }
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return normalizeWhitespace(ariaLabel);
  const closestLabel = element.closest('label');
  if (closestLabel) {
    const clone = closestLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, textarea, select, button').forEach((node) => node.remove());
    const text = normalizeWhitespace(clone.textContent ?? '');
    if (text) return text;
  }
  const container = element.closest('div, fieldset, li, td, dd, section');
  if (container) {
    const label = container.querySelector('label, legend, .label, [class*="label" i], [data-automation-id*="label" i]');
    const text = normalizeWhitespace(label?.textContent ?? '');
    if (text && text.length < 160) return text;
    const firstText = [...container.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && normalizeWhitespace(node.textContent ?? '').length > 2);
    if (firstText) return normalizeWhitespace(firstText.textContent ?? '');
  }
  const previous = element.previousElementSibling;
  if (previous) {
    const text = normalizeWhitespace(previous.textContent ?? '');
    if (text && text.length < 160 && !previous.querySelector('input, textarea, select')) return text;
  }
  const dataAutomation = element.getAttribute('data-automation-id');
  if (dataAutomation) return normalizeWhitespace(dataAutomation.replace(/[-_]/g, ' '));
  return normalizeWhitespace(element.getAttribute('placeholder') ?? element.getAttribute('name') ?? element.getAttribute('id') ?? '');
}

export function scanFields(root: ParentNode = document): ScannedField[] {
  const elements = [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')];
  const fields: ScannedField[] = [];
  for (const element of elements) {
    const type = (element.getAttribute('type') ?? element.tagName.toLowerCase()).toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(type)) continue;
    const label = resolveLabel(element);
    const classification = classifyField({
      label,
      name: element.getAttribute('name') ?? '',
      id: element.getAttribute('id') ?? '',
      placeholder: element.getAttribute('placeholder') ?? '',
      autocomplete: element.getAttribute('autocomplete') ?? '',
      type,
      ariaLabel: element.getAttribute('aria-label') ?? '',
    });
    fields.push({
      element,
      label: label || labelForField(classification.key),
      key: classification.key,
      confidence: classification.confidence,
      type,
      name: element.getAttribute('name') ?? '',
      id: element.getAttribute('id') ?? '',
      required: element.hasAttribute('required') || element.getAttribute('aria-required') === 'true',
      visible: visible(element),
      options:
        element instanceof HTMLSelectElement
          ? [...element.options].map((option) => ({ value: option.value, label: normalizeWhitespace(option.textContent ?? '') }))
          : [],
      maxLength: element.getAttribute('maxlength') ? Number(element.getAttribute('maxlength')) : undefined,
    });
  }
  return fields;
}

export function hasApplicationForm(doc: Document = document): boolean {
  if (!doc.querySelector('input, textarea, select')) return false;
  if (doc.querySelector('form input[type="file"]')) return true;
  const fields = scanFields(doc);
  const signals = fields.filter((field) => field.key !== 'unknown' && field.confidence > 0.5).length;
  const hasResumeField = fields.some((field) => field.key === 'resumeFile');
  const hasSubmit = !!doc.querySelector('button[type="submit"], input[type="submit"]');
  return (signals >= 4 && hasSubmit) || hasResumeField;
}

const QUESTION_HINT = /(why|tell us|describe|explain|what|how|cover letter|motivat|interest|salary|expect|authoris|authoriz|sponsor|relocat|notice|available|additional|comment|question)/i;

export function detectQuestions(root: ParentNode = document, max = 12): ApplicationQuestion[] {
  const fields = scanFields(root).filter((field) => field.visible);
  const questions: ApplicationQuestion[] = [];
  for (const field of fields) {
    const isTextArea = field.element instanceof HTMLTextAreaElement;
    const longText = field.type === 'text' && field.label.length > 45;
    const questionish = QUESTION_HINT.test(field.label) || QUESTION_HINT.test(field.name);
    if (field.key === 'coverLetter' || isTextArea || questionish) {
      if (field.key === 'resumeFile' || field.key === 'coverLetterFile') continue;
      if (['email', 'phone', 'firstName', 'lastName', 'fullName', 'address1', 'city', 'state', 'postalCode'].includes(field.key) && !isTextArea) continue;
      questions.push({
        id: field.id || field.name || uid('q'),
        label: field.label || 'Application question',
        type: isTextArea ? 'textarea' : 'text',
        required: field.required,
        maxLength: field.maxLength,
        answer: '',
      });
      if (questions.length >= max) break;
      continue;
    }
    if (longText) {
      questions.push({
        id: field.id || field.name || uid('q'),
        label: field.label,
        type: 'text',
        required: field.required,
        maxLength: field.maxLength,
        answer: '',
      });
      if (questions.length >= max) break;
    }
  }
  return questions;
}

export function findFileInputs(root: ParentNode = document): HTMLInputElement[] {
  return [...root.querySelectorAll<HTMLInputElement>('input[type="file"]')].filter(visible);
}

export function fieldSignature(field: ScannedField): string {
  return `${field.key}:${field.name || field.id || field.label}`.toLowerCase().slice(0, 160);
}
