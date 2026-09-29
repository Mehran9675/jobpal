import { storageLocalGet, storageLocalSet } from '@/lib/browser';
import type { ExtractedJob } from '@/types';
import type { FieldKey } from '@/lib/autofill/fields';
import { normalizeWhitespace } from '@/lib/utils';
import { readableText } from './readability';

export interface JobSelectors {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  description?: string;
}

export interface FormMapping {
  selector: string;
  key: FieldKey;
  label?: string;
}

/** Where a generated answer should be typed, learned from a user pick. */
export interface AnswerTarget {
  question: string;
  selector: string;
  answer?: string;
}

/** Where a generated file should be attached, learned from a user pick. */
export interface FileTarget {
  kind: string;
  selector: string;
}

export interface SiteRecipe {
  host: string;
  job: JobSelectors;
  formFields: FormMapping[];
  answerTargets?: AnswerTarget[];
  fileTargets?: FileTarget[];
  updatedAt: number;
}

const RECIPES_KEY = 'jobpal.recipes';

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function getRecipe(host: string): Promise<SiteRecipe | null> {
  if (!host) return null;
  const stored = await storageLocalGet<Record<string, SiteRecipe>>([RECIPES_KEY]);
  return stored[RECIPES_KEY]?.[host] ?? null;
}

export async function saveRecipe(recipe: SiteRecipe): Promise<void> {
  const stored = await storageLocalGet<Record<string, SiteRecipe>>([RECIPES_KEY]);
  const all = stored[RECIPES_KEY] ?? {};
  all[recipe.host] = { ...recipe, updatedAt: Date.now() };
  await storageLocalSet({ [RECIPES_KEY]: all });
}

export async function clearRecipe(host: string): Promise<void> {
  const stored = await storageLocalGet<Record<string, SiteRecipe>>([RECIPES_KEY]);
  const all = stored[RECIPES_KEY] ?? {};
  delete all[host];
  await storageLocalSet({ [RECIPES_KEY]: all });
}

export async function listRecipes(): Promise<SiteRecipe[]> {
  const stored = await storageLocalGet<Record<string, SiteRecipe>>([RECIPES_KEY]);
  return Object.values(stored[RECIPES_KEY] ?? {}).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Builds a stable, human-readable selector for an element the user picked. */
export function elementSelector(element: Element): string {
  if (element.id && document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) {
    return `#${CSS.escape(element.id)}`;
  }
  for (const attribute of ['data-testid', 'data-automation-id', 'data-qa', 'itemprop', 'name']) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    const candidate = `[${attribute}="${CSS.escape(value)}"]`;
    try {
      if (document.querySelectorAll(candidate).length === 1) return candidate;
    } catch {
      /* keep walking */
    }
  }
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== document.body && node !== document.documentElement && parts.length < 6) {
    let part = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (parent) {
      const current: Element = node;
      const sameTag = [...parent.children].filter((child) => child.tagName === current.tagName);
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    const candidate = parts.join(' > ');
    try {
      if (document.querySelectorAll(candidate).length === 1) return candidate;
    } catch {
      break;
    }
    node = parent;
  }
  return parts.join(' > ');
}

export function readSelector(doc: Document, selector: string | undefined, mode: 'text' | 'block' = 'text'): string | undefined {
  if (!selector) return undefined;
  let element: Element | null = null;
  try {
    element = doc.querySelector(selector);
  } catch {
    return undefined;
  }
  if (!element) return undefined;
  if (mode === 'block') {
    const text = readableText(doc, element as HTMLElement);
    return text || undefined;
  }
  return normalizeWhitespace(element.textContent ?? '') || undefined;
}

/** Reads a saved job recipe from the page. Returns null when nothing matches. */
export function applyRecipe(doc: Document, recipe: SiteRecipe, url: string): Partial<ExtractedJob> | null {
  const description = readSelector(doc, recipe.job.description, 'block');
  const title = readSelector(doc, recipe.job.title);
  if (!title && !description) return null;
  const location = readSelector(doc, recipe.job.location);
  const company = readSelector(doc, recipe.job.company);
  const salary = readSelector(doc, recipe.job.salary);
  return {
    url,
    canonicalUrl: url,
    title: title ?? '',
    company: company ?? '',
    location,
    salary,
    description: description ?? '',
    remote: /remote|anywhere|distributed/i.test(`${location ?? ''} ${title ?? ''}`),
    requirements: [],
    keywords: [],
  };
}
