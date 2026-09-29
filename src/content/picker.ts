import { normalizeWhitespace } from '@/lib/utils';
import { readableText } from '@/lib/job/readability';

export type PickTarget = 'title' | 'company' | 'location' | 'salary' | 'description' | 'formField' | 'answer' | 'file';

export const PICK_LABELS: Record<PickTarget, string> = {
  title: 'Job title',
  company: 'Company',
  location: 'Location',
  salary: 'Salary',
  description: 'Job description',
  formField: 'Form field',
  answer: 'Answer field',
  file: 'File upload field',
};

export interface PickResult {
  element: HTMLElement;
  selector: string;
  value: string;
  label: string;
}

let active = false;

export function isPicking(): boolean {
  return active;
}

/**
 * Lets the user click any element on the page to tell JobPal where a piece of
 * information lives. Returns null when the user presses Escape.
 */
export function startPicking(target: PickTarget, selectorFor: (element: Element) => string): Promise<PickResult | null> {
  return new Promise((resolve) => {
    if (active || !document.body) {
      resolve(null);
      return;
    }
    active = true;

    const highlight = document.createElement('div');
    highlight.setAttribute('data-jobpal-picker', 'highlight');
    Object.assign(highlight.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483646',
      border: '2px solid #6d6ff5',
      background: 'rgba(109, 111, 245, 0.14)',
      borderRadius: '6px',
      boxSizing: 'border-box',
    } as Partial<CSSStyleDeclaration>);

    const badge = document.createElement('div');
    badge.setAttribute('data-jobpal-picker', 'badge');
    badge.textContent = `JobPal · ${PICK_LABELS[target]} — click to select, Esc to cancel`;
    Object.assign(badge.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647',
      padding: '6px 10px',
      borderRadius: '8px',
      background: '#101114',
      color: '#f4f5f7',
      font: '600 12px/1.3 Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
      maxWidth: '340px',
    } as Partial<CSSStyleDeclaration>);

    document.documentElement.append(highlight, badge);

    const positionBadge = (rect: DOMRect) => {
      const top = rect.top > 44 ? rect.top - 34 : Math.min(window.innerHeight - 40, rect.bottom + 8);
      badge.style.top = `${top}px`;
      badge.style.left = `${Math.max(8, Math.min(window.innerWidth - 320, rect.left))}px`;
    };

    const onMove = (event: MouseEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      if (!element || element.closest('[data-jobpal-picker]')) return;
      const rect = element.getBoundingClientRect();
      Object.assign(highlight.style, {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      } as Partial<CSSStyleDeclaration>);
      positionBadge(rect);
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      highlight.remove();
      badge.remove();
      active = false;
    };

    const onScroll = () => {
      badge.style.opacity = '0.2';
      setTimeout(() => (badge.style.opacity = '1'), 250);
    };

    const onClick = (event: MouseEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!element || element.closest('[data-jobpal-picker]')) {
        resolve(null);
        cleanup();
        return;
      }
      const result: PickResult = {
        element,
        selector: selectorFor(element),
        value: target === 'description' ? readableText(document, element) : normalizeWhitespace(element.textContent ?? ''),
        label: normalizeWhitespace(element.getAttribute('aria-label') ?? element.getAttribute('title') ?? element.tagName.toLowerCase()),
      };
      cleanup();
      resolve(result);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup();
        resolve(null);
      }
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
  });
}
