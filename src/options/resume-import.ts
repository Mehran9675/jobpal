import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth/mammoth.browser';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return extractPdfText(file);
  if (name.endsWith('.docx')) return extractDocxText(file);
  if (name.endsWith('.json')) {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as { basics?: unknown };
      if (parsed && typeof parsed === 'object' && 'basics' in parsed) {
        return jsonResumeToText(parsed as Record<string, unknown>);
      }
    } catch {
      /* fall through to raw text */
    }
    return text;
  }
  return file.text();
}

async function extractPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;
    for (const item of content.items) {
      const textItem = item as { str?: string; transform?: number[]; hasEOL?: boolean };
      if (typeof textItem.str !== 'string') continue;
      const y = textItem.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2.4) {
        lines.push(currentLine.trim());
        currentLine = '';
      }
      currentLine += `${textItem.str} `;
      if (textItem.hasEOL) {
        lines.push(currentLine.trim());
        currentLine = '';
      }
      lastY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    pages.push(lines.join('\n'));
  }
  await document.destroy();
  return pages.join('\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

function jsonResumeToText(resume: Record<string, unknown>): string {
  const basics = (resume.basics ?? {}) as Record<string, string>;
  const lines: string[] = [];
  if (basics.name) lines.push(basics.name);
  if (basics.label) lines.push(basics.label);
  const contact = [basics.email, basics.phone, basics.url].filter(Boolean);
  if (contact.length > 0) lines.push(contact.join(' | '));
  if (basics.summary) lines.push('', 'SUMMARY', basics.summary);
  const work = (resume.work ?? []) as Record<string, unknown>[];
  if (work.length > 0) {
    lines.push('', 'EXPERIENCE');
    for (const item of work) {
      lines.push(`${item.position ?? ''} — ${item.name ?? ''} (${item.startDate ?? ''} – ${item.endDate ?? 'Present'})`);
      if (item.summary) lines.push(String(item.summary));
      for (const highlight of (item.highlights ?? []) as string[]) lines.push(`• ${highlight}`);
    }
  }
  const education = (resume.education ?? []) as Record<string, unknown>[];
  if (education.length > 0) {
    lines.push('', 'EDUCATION');
    for (const item of education) lines.push(`${item.studyType ?? ''} ${item.area ?? ''} — ${item.institution ?? ''}`);
  }
  const skills = (resume.skills ?? []) as Record<string, unknown>[];
  if (skills.length > 0) {
    lines.push('', 'SKILLS');
    for (const group of skills) lines.push(`${group.name ?? 'Skills'}: ${((group.keywords ?? []) as string[]).join(', ')}`);
  }
  return lines.join('\n');
}
