import { normalizeWhitespace } from '@/lib/utils';

const STRIP_SELECTORS = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'iframe',
  'nav',
  'footer',
  'header nav',
  '[role="navigation"]',
  '[role="banner"]',
  '[aria-hidden="true"]',
  '.cookie',
  '#cookie-banner',
  '[class*="cookie"]',
  '[class*="Cookie"]',
  '[class*="breadcrumb"]',
  '[class*="Breadcrumb"]',
  '[class*="newsletter"]',
  '[class*="Newsletter"]',
  '[class*="related-jobs"]',
  '[class*="similar-jobs"]',
  '[class*="recommended"]',
  '[class*="footer"]',
  '[class*="Footer"]',
  '[id*="footer"]',
  '[class*="sidebar"]',
  '[class*="advertisement"]',
  '[class*="ads-"]',
];

export function cleanClone(doc: Document): HTMLElement {
  const root = doc.body?.cloneNode(true) as HTMLElement | undefined;
  if (!root) {
    const fallback = doc.createElement('div');
    return fallback;
  }
  for (const selector of STRIP_SELECTORS) {
    root.querySelectorAll(selector).forEach((node) => node.remove());
  }
  root.querySelectorAll('*').forEach((node) => {
    if (node.children.length === 0 && normalizeWhitespace(node.textContent ?? '').length === 0) node.remove();
  });
  return root;
}

export function readableText(doc: Document, root?: HTMLElement): string {
  const source = root ?? doc.body;
  if (!source) return '';
  const clone = source.cloneNode(true) as HTMLElement;
  for (const selector of STRIP_SELECTORS) clone.querySelectorAll(selector).forEach((node) => node.remove());
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  clone.querySelectorAll('li').forEach((li) => li.append('\n'));
  clone.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, tr').forEach((node) => node.append('\n'));
  const text = clone.innerText ?? clone.textContent ?? '';
  return text
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line, index, array) => line.length > 0 && array.indexOf(line) === index)
    .join('\n')
    .trim();
}

export function mainContentElement(doc: Document): HTMLElement | null {
  const selectors = [
    '[class*="job-description"]',
    '[class*="jobDescription"]',
    '[data-testid*="jobDescription"]',
    '#job-details',
    '#jobDescriptionText',
    '.jobsearch-JobComponent-description',
    '[class*="description__text"]',
    '#content .section-wrapper',
    '[data-automation-id="jobPostingDescription"]',
    '[class*="posting-page"]',
    'article',
    'main',
    '[role="main"]',
  ];
  for (const selector of selectors) {
    const element = doc.querySelector<HTMLElement>(selector);
    if (element && normalizeWhitespace(element.textContent ?? '').length > 400) return element;
  }
  return null;
}

/**
 * True when the text reads like prose rather than form labels or menus: at
 * least two lines of eight or more words, forty words overall and two
 * sentence-like stretches. Keeps input labels and select options from being
 * mistaken for a job description.
 */
export function looksLikeProse(text: string): boolean {
  const lines = text
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length > 0);
  const words = lines.reduce((count, line) => count + line.split(/\s+/).length, 0);
  if (words < 40) return false;
  const proseLines = lines.filter((line) => line.split(/\s+/).length >= 8);
  if (proseLines.length < 2) return false;
  const sentences = text.split(/[.!?](\s|$)/).filter((part) => part.trim().split(/\s+/).length >= 6);
  return sentences.length >= 2;
}

/** The stricter check for anything presented as a job description. */
export function looksLikeJobDescription(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 200) return false;
  return looksLikeProse(trimmed);
}

export function jobDescriptionText(doc: Document): string {
  const main = mainContentElement(doc);
  const mainText = main ? readableText(doc, main) : '';
  if (looksLikeJobDescription(mainText)) return mainText;
  return readableText(doc);
}

export function metaContent(doc: Document, names: string[]): string | undefined {
  for (const name of names) {
    const element =
      doc.querySelector<HTMLMetaElement>(`meta[property="${name}"]`) ??
      doc.querySelector<HTMLMetaElement>(`meta[name="${name}"]`) ??
      doc.querySelector<HTMLMetaElement>(`meta[itemprop="${name}"]`);
    const value = element?.content?.trim();
    if (value) return value;
  }
  return undefined;
}

export function stripHtml(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  container.querySelectorAll('li').forEach((li) => li.prepend('• '));
  const text = container.innerText || container.textContent || '';
  return normalizeWhitespace(text.replace(/\n{2,}/g, '\n'));
}

export function jsonLdObjects(doc: Document): unknown[] {
  const out: unknown[] = [];
  doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]').forEach((script) => {
    const raw = script.textContent?.trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed && typeof parsed === 'object') {
        const graph = (parsed as { '@graph'?: unknown[] })['@graph'];
        if (Array.isArray(graph)) out.push(...graph);
        else out.push(parsed);
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  });
  return out;
}

export function findJobPostingLd(doc: Document): Record<string, unknown> | null {
  for (const object of jsonLdObjects(doc)) {
    if (!object || typeof object !== 'object') continue;
    const type = (object as { '@type'?: unknown })['@type'];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((t) => typeof t === 'string' && t.toLowerCase() === 'jobposting')) {
      return object as Record<string, unknown>;
    }
  }
  return null;
}
