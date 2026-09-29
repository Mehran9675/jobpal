import type {
  ApplicationQuestion,
  DocFormat,
  DocKind,
  DocumentSettings,
  JobAnalysis,
  Profile,
  ResumeTemplate,
} from '@/types';
import { profileToResume, type ResumeJson } from './schema';
import { renderCoverLetterPdf, renderPlainPdf, renderResumePdf, type PlainDoc } from './render-pdf';
import { renderCoverLetterDocx, renderPlainDocx, renderResumeDocx } from './render-docx';
import { renderCoverLetterHtml, renderResumeHtml } from './render-html';
import { renderMarkdownDoc, renderResumeMarkdown, renderResumePlainText } from './render-text';
import { escapeHtml, sanitizeFilename, textToBlob } from '@/lib/utils';

export const MIME: Record<DocFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  md: 'text/markdown',
  txt: 'text/plain',
  html: 'text/html',
  json: 'application/json',
};

export interface RenderedFile {
  kind: DocKind;
  format: DocFormat;
  filename: string;
  mime: string;
  blob: Blob;
  preview?: string;
  templateId: string;
}

export interface RenderRequest {
  kinds: DocKind[];
  formats: DocFormat[];
  profile: Profile;
  template: ResumeTemplate;
  settings: DocumentSettings;
  target?: { title?: string; company?: string; url?: string; keywords?: string[] };
  coverLetterText?: string;
  answers?: ApplicationQuestion[];
  analysis?: JobAnalysis;
}

function buildFilename(pattern: string, vars: Record<string, string>): string {
  const filled = pattern.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? '');
  return sanitizeFilename(filled.replace(/\s+/g, ' '));
}

function fileVars(kind: DocKind, profile: Profile, target?: { title?: string; company?: string }, templateId?: string): Record<string, string> {
  const kindLabel =
    kind === 'cover_letter' ? 'cover-letter' : kind === 'json_resume' ? 'resume-json' : kind === 'answers' ? 'answers' : kind === 'portfolio' ? 'portfolio' : 'resume';
  const displayName = [profile.contact.firstName, profile.contact.lastName].filter(Boolean).join(' ').trim() || 'Candidate';
  return {
    name: displayName.replace(/\s+/g, '-'),
    kind: kindLabel,
    company: (target?.company ?? '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-'),
    role: (target?.title ?? '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-'),
    date: new Date().toISOString().slice(0, 10),
    template: templateId ?? '',
  };
}

function bytesToBlob(bytes: Uint8Array, mime: string): Blob {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer as ArrayBuffer], { type: mime });
}

async function renderOne(
  kind: DocKind,
  format: DocFormat,
  request: RenderRequest,
  resume: ResumeJson,
): Promise<RenderedFile | null> {
  const { template, settings, profile, target } = request;
  const vars = fileVars(kind, profile, target, template.id);
  const baseName = buildFilename(settings.fileNamePattern, vars);
  const filename = `${baseName}.${format}`;

  const finish = (blob: Blob, preview?: string): RenderedFile => ({
    kind,
    format,
    filename,
    mime: MIME[format],
    blob,
    preview,
    templateId: template.id,
  });

  if (kind === 'resume') {
    const html = renderResumeHtml(resume, template, settings);
    switch (format) {
      case 'pdf':
        return finish(bytesToBlob(await renderResumePdf(resume, template, settings), MIME.pdf), html);
      case 'docx':
        return finish(bytesToBlob(await renderResumeDocx(resume, template, settings), MIME.docx), html);
      case 'html':
        return finish(textToBlob(html, MIME.html), html);
      case 'md':
        return finish(textToBlob(renderResumeMarkdown(resume), MIME.md));
      case 'txt':
        return finish(textToBlob(renderResumePlainText(resume, template), MIME.txt));
      case 'json':
        return finish(textToBlob(JSON.stringify(resume, null, 2), MIME.json));
      default:
        return null;
    }
  }

  if (kind === 'cover_letter') {
    const body = request.coverLetterText ?? '';
    const html = renderCoverLetterHtml(resume, template, settings, body, target);
    switch (format) {
      case 'pdf':
        return finish(bytesToBlob(await renderCoverLetterPdf(resume, template, settings, body, target), MIME.pdf), html);
      case 'docx':
        return finish(bytesToBlob(await renderCoverLetterDocx(resume, template, settings, body, target), MIME.docx), html);
      case 'html':
        return finish(textToBlob(html, MIME.html), html);
      case 'md':
      case 'txt':
        return finish(textToBlob(body, MIME.txt));
      case 'json':
        return finish(textToBlob(JSON.stringify({ kind: 'cover_letter', body, target }, null, 2), MIME.json));
      default:
        return null;
    }
  }

  if (kind === 'answers') {
    const answered = (request.answers ?? []).filter((question) => question.answer);
    if (answered.length === 0) return null;
    const sections = answered.map((question) => ({ heading: question.label, lines: [question.answer ?? ''] }));
    const ownerName = resume.basics.name;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>Answers</title>
<style>body{font-family:Inter,Arial,sans-serif;color:#14161c;background:#f3f4f8;margin:0}.page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:20mm;font-size:11pt;line-height:1.55}
h1{font-size:20pt;margin:0 0 2px}h2{font-size:11.5pt;color:${settings.accentOverride ?? template.accent};margin:6mm 0 1mm}p{margin:0 0 4mm}
.meta{color:#5b6270;font-size:9.6pt;margin-bottom:6mm}@media print{body{background:#fff}@page{size:${settings.pageSize === 'a4' ? 'A4' : 'letter'};margin:0}}
</style></head><body><div class="page"><h1>Answers</h1><div class="meta">${escapeHtml(ownerName)}</div>${sections
      .map((section) => `<h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.lines[0])}</p>`)
      .join('')}</div></body></html>`;
    const plain: PlainDoc = { title: `${ownerName} - Answers`, sections: sections.map((section) => ({ heading: section.heading, lines: section.lines })) };
    switch (format) {
      case 'pdf':
        return finish(bytesToBlob(await renderPlainPdf(plain, template, settings, resume.basics), MIME.pdf), html);
      case 'docx':
        return finish(bytesToBlob(await renderPlainDocx(plain, template, settings), MIME.docx), html);
      case 'html':
        return finish(textToBlob(html, MIME.html), html);
      case 'md':
        return finish(textToBlob(renderMarkdownDoc(plain.title, plain.subtitle, sections, false), MIME.md));
      case 'txt':
        return finish(textToBlob(sections.map((section) => `${section.heading}\n${section.lines[0]}`).join('\n\n'), MIME.txt));
      case 'json':
        return finish(textToBlob(JSON.stringify(answered.map((question) => ({ question: question.label, answer: question.answer })), null, 2), MIME.json));
      default:
        return null;
    }
  }

  if (kind === 'json_resume') {
    if (format === 'json') return finish(textToBlob(JSON.stringify(resume, null, 2), MIME.json));
    return renderOne('resume', format, request, resume);
  }

  return null;
}

export async function renderFiles(request: RenderRequest): Promise<RenderedFile[]> {
  const resume = profileToResume(request.profile, {
    template: request.template,
    settings: request.settings,
    job: request.target ? { title: request.target.title ?? '', company: request.target.company ?? '', url: request.target.url ?? '', keywords: request.target.keywords ?? [] } : undefined,
  });
  const files: RenderedFile[] = [];
  for (const kind of request.kinds) {
    for (const format of request.formats) {
      const file = await renderOne(kind, format, request, resume);
      if (file) files.push(file);
    }
  }
  return files;
}

export function previewHtml(request: Omit<RenderRequest, 'kinds' | 'formats'> & { kind: DocKind }): string {
  const resume = profileToResume(request.profile, {
    template: request.template,
    settings: request.settings,
    job: request.target ? { title: request.target.title ?? '', company: request.target.company ?? '', url: request.target.url ?? '', keywords: request.target.keywords ?? [] } : undefined,
  });
  if (request.kind === 'cover_letter') return renderCoverLetterHtml(resume, request.template, request.settings, request.coverLetterText ?? '', request.target);
  if (request.kind === 'answers') {
    const answered = (request.answers ?? []).filter((question) => question.answer);
    return `<html><body style="font-family:Inter,Arial,sans-serif;padding:24px;color:#111">${answered
      .map((question) => `<h3>${question.label}</h3><p>${question.answer}</p>`)
      .join('')}</body></html>`;
  }
  return renderResumeHtml(resume, request.template, request.settings, { preview: true });
}

export function toResumeJson(profile: Profile, request: Pick<RenderRequest, 'template' | 'settings' | 'target'>): ResumeJson {
  return profileToResume(profile, {
    template: request.template,
    settings: request.settings,
    job: request.target ? { title: request.target.title ?? '', company: request.target.company ?? '', url: request.target.url ?? '', keywords: request.target.keywords ?? [] } : undefined,
  });
}
