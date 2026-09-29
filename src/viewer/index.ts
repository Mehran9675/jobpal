import '@/ui/styles/app.scss';
import { getDocument } from '@/lib/db';
import { formatBytes } from '@/lib/utils';
import type { DocumentRecord } from '@/types';

const root = document.getElementById('root');
const params = new URLSearchParams(location.search);
const documentId = params.get('id') ?? '';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function shell(): { header: HTMLElement; toolbar: HTMLElement; body: HTMLElement } {
  if (!root) throw new Error('viewer root missing');
  root.replaceChildren();
  const page = el('div', 'viewer');
  const header = el('header', 'viewer__header');
  const toolbar = el('div', 'viewer__actions');
  const body = el('div', 'viewer__body');
  header.append(toolbar);
  page.append(header, body);
  root.append(page);
  return { header, toolbar, body };
}

async function blobUrl(record: DocumentRecord): Promise<string> {
  return URL.createObjectURL(record.blob);
}

async function render(): Promise<void> {
  if (!root) return;
  if (!documentId) {
    renderError('No document was specified.', 'Open this viewer from JobPaal → Documents → View.');
    return;
  }
  let record: DocumentRecord | undefined;
  try {
    record = await getDocument(documentId);
  } catch (error) {
    renderError('Could not read the document.', error instanceof Error ? error.message : String(error));
    return;
  }
  if (!record) {
    renderError('Document not found.', 'It may have been deleted. Open JobPaal → Documents to check.');
    return;
  }

  const { header, toolbar, body } = shell();
  document.title = `${record.filename} - JobPaal`;

  const meta = el('div');
  meta.append(el('div', 'viewer__title', record.filename));
  meta.append(
    el(
      'div',
      'viewer__meta',
      [
        record.kind.replace('_', ' '),
        record.format.toUpperCase(),
        formatBytes(record.size),
        record.uploaded ? 'uploaded by you' : record.templateId ? `template ${record.templateId}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    ),
  );

  const downloadAction = async (): Promise<void> => {
    const url = await blobUrl(record as DocumentRecord);
    const anchor = el('a');
    anchor.href = url;
    anchor.download = (record as DocumentRecord).filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const download = el('button', 'btn btn--primary btn--sm', 'Download');
  download.addEventListener('click', () => void downloadAction());

  const copy = el('button', 'btn btn--outline btn--sm', 'Copy text');
  copy.addEventListener('click', async () => {
    const text = await documentText(record as DocumentRecord);
    if (!text) return;
    await navigator.clipboard.writeText(text);
    copy.textContent = 'Copied';
    setTimeout(() => (copy.textContent = 'Copy text'), 1600);
  });

  const openRaw = el('button', 'btn btn--ghost btn--sm', 'Open raw file');
  openRaw.addEventListener('click', async () => {
    const url = await blobUrl(record as DocumentRecord);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });

  toolbar.append(download, copy, openRaw);
  header.prepend(meta);

  const format = record.format;
  if (format === 'pdf' || format === 'html') {
    const url = await blobUrl(record);
    const frame = el('iframe', 'viewer__frame');
    frame.src = url;
    frame.title = record.filename;
    body.append(frame);
    return;
  }

  if (format === 'docx') {
    const notice = el('div', 'viewer__notice');
    notice.append(el('div', 'strong', 'DOCX files cannot be rendered directly by the browser.'));
    notice.append(el('p', 'muted small', 'Download the file (or open the HTML version of the same document) to read it. Your browser may also offer to open it in Word or Google Docs.'));
    const actions = el('div', 'row');
    const downloadAgain = el('button', 'btn btn--primary btn--sm', 'Download');
    downloadAgain.addEventListener('click', () => void downloadAction());
    actions.append(downloadAgain);
    notice.append(actions);
    body.append(notice);
    return;
  }

  const text = await documentText(record);
  if (!text) {
    body.append(el('div', 'viewer__notice', 'This file has no text preview - use Download or Open raw file.'));
    return;
  }
  const pre = el('pre', 'viewer__text');
  pre.textContent = text;
  body.append(pre);
}

async function documentText(record: DocumentRecord): Promise<string> {
  try {
    const raw = await record.blob.text();
    if (record.format === 'json') {
      try {
        return JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        return raw;
      }
    }
    return raw;
  } catch {
    return record.textPreview ?? '';
  }
}

function renderError(title: string, message: string): void {
  if (!root) return;
  root.replaceChildren();
  const page = el('div', 'viewer');
  const notice = el('div', 'viewer__notice');
  notice.append(el('div', 'strong', title));
  notice.append(el('p', 'muted small', message));
  page.append(notice);
  root.append(page);
}

void render();
