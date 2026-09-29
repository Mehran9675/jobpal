import { PDFArray, PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { DocumentSettings, ResumeTemplate, SectionId } from '@/types';
import { contactLine, dateRange, effectiveSectionOrder, sectionHasContent, type ResumeJson } from './schema';
import { base64ToUint8 } from '@/lib/utils';

const PAGE_SIZES: Record<'a4' | 'letter', [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

interface FontSet {
  body: PDFFont;
  bodyBold: PDFFont;
  bodyItalic: PDFFont;
  heading: PDFFont;
  headingBold: PDFFont;
}

interface Palette {
  accent: RGB;
  accentSoft: RGB;
  text: RGB;
  muted: RGB;
  line: RGB;
  onAccent: RGB;
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
  const int = Number.parseInt(value || '6366f1', 16);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

function mixColor(a: RGB, b: RGB, ratio: number): RGB {
  return rgb(a.red + (b.red - a.red) * ratio, a.green + (b.green - a.green) * ratio, a.blue + (b.blue - a.blue) * ratio);
}

const SMART_MAP: [RegExp, string][] = [
  [/[\u2018\u2019\u201b]/g, "'"],
  [/[\u201c\u201d\u201f]/g, '"'],
  [/[\u2013\u2014]/g, '-'],
  [/[\u2026]/g, '...'],
  [/[\u2022\u25cf\u25aa]/g, '-'],
  [/[\u00a0\u2009\u202f]/g, ' '],
  [/[\u2192]/g, '->'],
  [/[\u2265]/g, '>='],
  [/[\u2264]/g, '<='],
  [/[\u00b7]/g, '·'],
];

function sanitize(text: string, asciiOnly: boolean): string {
  let out = text.normalize('NFC');
  for (const [pattern, replacement] of SMART_MAP) out = out.replace(pattern, replacement);
  if (asciiOnly) out = out.replace(/[^\u0000-\u00ff]/g, '');
  return out;
}

interface RenderContext {
  doc: PDFDocument;
  page: ReturnType<PDFDocument['addPage']>;
  fonts: FontSet;
  palette: Palette;
  template: ResumeTemplate;
  settings: DocumentSettings;
  asciiOnly: boolean;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  y: number;
  contentX: number;
  contentWidth: number;
  bodySize: number;
  lineHeight: number;
  sectionGap: number;
  sidebarY: number;
  resumeName: string;
}

/**
 * Metrics mirror the HTML templates in render-html.ts one-to-one, so the
 * generated PDF and the preview are visually identical.
 * CSS pt values map directly to PDF points on the same page size.
 */
function typography(template: ResumeTemplate, settings: DocumentSettings) {
  const density = settings.densityOverride ?? template.density;
  const compact = density === 'compact';
  return {
    bodySize: compact ? 10.2 : 10.8,
    lineHeight: 1.45,
    sectionGap: 15.6,
    nameSize: compact ? 20 : 24,
    headlineSize: 11,
    headingSize: 10.6,
    metaSize: 9.4,
    entryTitle: 11,
    entrySub: 9.8,
    entryDate: 9.2,
    entryDesc: 10,
    chipSize: 9,
    margin: compact ? 39.7 : 51,
  };
}

async function embedFonts(doc: PDFDocument, template: ResumeTemplate, settings: DocumentSettings): Promise<{ fonts: FontSet; asciiOnly: boolean }> {
  if (settings.customFont?.dataUrl) {
    try {
      doc.registerFontkit(fontkit);
      const bytes = base64ToUint8(settings.customFont.dataUrl);
      const font = await doc.embedFont(bytes, { subset: true });
      return {
        fonts: { body: font, bodyBold: font, bodyItalic: font, heading: font, headingBold: font },
        asciiOnly: false,
      };
    } catch (error) {
      console.warn('[jobpal] custom font failed, falling back to standard fonts', error);
    }
  }
  const sans = template.font === 'serif' ? false : true;
  if (template.font === 'serif') {
    return {
      fonts: {
        body: await doc.embedFont(StandardFonts.TimesRoman),
        bodyBold: await doc.embedFont(StandardFonts.TimesRomanBold),
        bodyItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
        heading: await doc.embedFont(StandardFonts.TimesRomanBold),
        headingBold: await doc.embedFont(StandardFonts.TimesRomanBold),
      },
      asciiOnly: true,
    };
  }
  if (template.font === 'mixed') {
    return {
      fonts: {
        body: await doc.embedFont(StandardFonts.Helvetica),
        bodyBold: await doc.embedFont(StandardFonts.HelveticaBold),
        bodyItalic: await doc.embedFont(StandardFonts.HelveticaOblique),
        heading: await doc.embedFont(StandardFonts.TimesRomanBold),
        headingBold: await doc.embedFont(StandardFonts.TimesRomanBold),
      },
      asciiOnly: true,
    };
  }
  void sans;
  return {
    fonts: {
      body: await doc.embedFont(StandardFonts.Helvetica),
      bodyBold: await doc.embedFont(StandardFonts.HelveticaBold),
      bodyItalic: await doc.embedFont(StandardFonts.HelveticaOblique),
      heading: await doc.embedFont(StandardFonts.HelveticaBold),
      headingBold: await doc.embedFont(StandardFonts.HelveticaBold),
    },
    asciiOnly: true,
  };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function ctxText(ctx: RenderContext, text: string, options: {
  x?: number;
  y?: number;
  size?: number;
  font?: PDFFont;
  color?: RGB;
  maxWidth?: number;
  lineHeight?: number;
  opacity?: number;
} = {}): number {
  const font = options.font ?? ctx.fonts.body;
  const size = options.size ?? ctx.bodySize;
  const color = options.color ?? ctx.palette.text;
  const maxWidth = options.maxWidth ?? ctx.contentWidth;
  const lineHeight = options.lineHeight ?? ctx.lineHeight;
  const x = options.x ?? ctx.contentX;
  let y = options.y ?? ctx.y;
  const lines = wrapText(sanitize(text, ctx.asciiOnly), font, size, maxWidth);
  for (const line of lines) {
    ctx.page.drawText(line, { x, y, size, font, color, opacity: options.opacity ?? 1 });
    y -= size * lineHeight;
  }
  return y;
}

/** Adds a clickable link annotation over a piece of drawn text. */
function linkAnnotation(ctx: RenderContext, url: string, x: number, baseline: number, width: number, size: number): void {
  try {
    const href = /^(https?:\/\/|mailto:|tel:)/i.test(url) ? url : `https://${url}`;
    const annotation = ctx.doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, baseline - size * 0.3, x + width, baseline + size * 0.95],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(href) },
    });
    const ref = ctx.doc.context.register(annotation);
    let annots = ctx.page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (!annots) {
      annots = ctx.doc.context.obj([]) as PDFArray;
      ctx.page.node.set(PDFName.of('Annots'), annots);
    }
    annots.push(ref);
  } catch {
    /* links are best effort */
  }
}

interface InlineSegment {
  text: string;
  url?: string;
  color?: RGB;
  font?: PDFFont;
  opacity?: number;
}

/** Contact line segments: the email becomes a clickable mailto link. */
function contactSegments(resume: ResumeJson, ctx: RenderContext): InlineSegment[] {
  const segments: InlineSegment[] = [];
  if (resume.basics.email) segments.push({ text: sanitize(resume.basics.email, ctx.asciiOnly), url: `mailto:${resume.basics.email}` });
  if (resume.basics.phone) segments.push({ text: sanitize(resume.basics.phone, ctx.asciiOnly) });
  const locationText = [resume.basics.location.city, resume.basics.location.countryCode].filter(Boolean).join(', ');
  if (locationText) segments.push({ text: sanitize(locationText, ctx.asciiOnly) });
  return segments;
}

function linkSegments(resume: ResumeJson, ctx: RenderContext): InlineSegment[] {
  return resume.basics.profiles.map((profile) => ({
    text: sanitize(profile.url.replace(/^https?:\/\//, ''), ctx.asciiOnly),
    url: profile.url,
  }));
}

/** Draws inline text segments (email · phone · links…) with wrapping and clickable URLs. */
function drawInlineSegments(
  ctx: RenderContext,
  segments: InlineSegment[],
  options: { centered: boolean; size: number; color: RGB; separator?: string; font?: PDFFont; lineHeight?: number; maxWidth?: number },
): void {
  const font = options.font ?? ctx.fonts.body;
  const separator = options.separator ?? '   ';
  const separatorWidth = separator ? font.widthOfTextAtSize(separator, options.size) : 0;
  const maxWidth = options.maxWidth ?? ctx.contentWidth;
  const rows: { segments: InlineSegment[]; widths: number[]; width: number }[] = [];
  let current: InlineSegment[] = [];
  let widths: number[] = [];
  let width = 0;

  const flush = () => {
    if (current.length > 0) rows.push({ segments: current, widths, width });
    current = [];
    widths = [];
    width = 0;
  };

  for (const segment of segments) {
    if (!segment.text) continue;
    const segmentWidth = font.widthOfTextAtSize(segment.text, options.size);
    const extra = current.length > 0 ? separatorWidth : 0;
    if (current.length > 0 && width + extra + segmentWidth > maxWidth) flush();
    if (current.length > 0) width += separatorWidth;
    current.push(segment);
    widths.push(segmentWidth);
    width += segmentWidth;
  }
  flush();

  for (const row of rows) {
    ensureSpace(ctx, options.size * 1.7 + 4);
    let x = ctx.contentX + (options.centered ? Math.max(0, (maxWidth - row.width) / 2) : 0);
    const baseline = ctx.y;
    row.segments.forEach((segment, index) => {
      ctx.page.drawText(segment.text, {
        x,
        y: baseline,
        size: options.size,
        font: segment.font ?? font,
        color: segment.color ?? options.color,
        opacity: segment.opacity ?? 1,
      });
      if (segment.url) linkAnnotation(ctx, segment.url, x, baseline, row.widths[index], options.size);
      x += row.widths[index] + separatorWidth;
    });
    ctx.y -= options.size * (options.lineHeight ?? 1.5);
  }
}

function ensureSpace(ctx: RenderContext, needed: number): void {
  if (ctx.y - needed >= ctx.margin * 0.7) return;
  ctx.page = ctx.doc.addPage([ctx.pageWidth, ctx.pageHeight]);
  ctx.y = ctx.pageHeight - ctx.margin;
  if (ctx.template.layout.startsWith('sidebar')) {
    drawSidebarBand(ctx, true);
    ctx.contentX = sidebarGeometry(ctx).contentX;
    ctx.contentWidth = sidebarGeometry(ctx).contentWidth;
  }
}

function sectionHeading(ctx: RenderContext, label: string, section: SectionId): void {
  void section;
  ensureSpace(ctx, 40);
  const { palette, template, fonts } = ctx;
  const typo = typography(template, ctx.settings);
  const text = template.headingCase === 'upper' ? label.toUpperCase() : label;
  const baseline = ctx.y;

  if (template.divider === 'dot') {
    ctx.page.drawCircle({ x: ctx.contentX + 3, y: baseline + 3.2, size: 2.6, color: palette.accent });
    ctxText(ctx, text, { x: ctx.contentX + 11, size: typo.headingSize, font: fonts.heading, color: palette.accent, maxWidth: ctx.contentWidth - 11, y: baseline });
  } else {
    ctxText(ctx, text, { x: ctx.contentX, size: typo.headingSize, font: fonts.heading, color: palette.accent, y: baseline });
  }

  // Mirrors .section-title border/bar and the 2.4mm margin below it.
  let cursor = baseline - typo.headingSize * 0.7;
  if (template.divider === 'line') {
    ctx.page.drawLine({
      start: { x: ctx.contentX, y: cursor },
      end: { x: ctx.contentX + ctx.contentWidth, y: cursor },
      thickness: 0.75,
      color: palette.line,
    });
  } else if (template.divider === 'bar') {
    ctx.page.drawRectangle({ x: ctx.contentX, y: cursor - 1.2, width: 34, height: 2.2, color: palette.accent });
  }
  ctx.y = cursor - typo.bodySize * 1.35;
}

function bullet(ctx: RenderContext, text: string, options: { x?: number; indent?: number; color?: RGB; size?: number } = {}): void {
  const size = options.size ?? ctx.bodySize;
  const indent = options.indent ?? 14.2;
  const x = (options.x ?? ctx.contentX) + indent;
  const maxWidth = ctx.contentWidth - indent;
  const lines = wrapText(sanitize(text, ctx.asciiOnly), ctx.fonts.body, size, maxWidth);
  ensureSpace(ctx, lines.length * size * ctx.lineHeight + 2);
  ctx.page.drawCircle({ x: x - 8, y: ctx.y + size * 0.32, size: 1.4, color: ctx.palette.accent });
  for (const line of lines) {
    ctx.page.drawText(line, { x, y: ctx.y, size, font: ctx.fonts.body, color: options.color ?? ctx.palette.text });
    ctx.y -= size * ctx.lineHeight;
  }
  ctx.y -= 2.8;
}

/** Chips that mirror the .chip style used by the HTML templates. */
function chipLayout(ctx: RenderContext, items: string[], options: { x: number; maxWidth: number; size?: number }): { positions: { text: string; width: number; x: number; row: number }[]; rows: number; lineHeight: number } {
  const size = options.size ?? 9;
  const padX = 4.5;
  const padY = 2.4;
  const gap = 4;
  const lineHeight = size + padY * 2 + 2.4;
  const positions: { text: string; width: number; x: number; row: number }[] = [];
  let x = options.x;
  let row = 0;
  for (const item of items) {
    const text = sanitize(item, ctx.asciiOnly);
    const width = ctx.fonts.body.widthOfTextAtSize(text, size) + padX * 2;
    if (x > options.x && x + width > options.x + options.maxWidth) {
      x = options.x;
      row += 1;
    }
    positions.push({ text, width, x, row });
    x += width + gap;
  }
  return { positions, rows: positions.length > 0 ? row + 1 : 0, lineHeight };
}

function drawChips(
  ctx: RenderContext,
  items: string[],
  options: { x: number; y: number; maxWidth: number; background: RGB; textColor: RGB; opacity?: number; size?: number },
): number {
  const size = options.size ?? 9;
  const padX = 4.5;
  const padY = 2.4;
  const { positions, rows, lineHeight } = chipLayout(ctx, items, options);
  if (rows === 0) return options.y;

  // Reserve the space first so chips can never overlap what follows.
  ensureSpace(ctx, rows * lineHeight + 6);
  const startY = ctx.y;
  for (const chip of positions) {
    const y = startY - chip.row * lineHeight;
    ctx.page.drawRectangle({
      x: chip.x,
      y: y - padY + 0.5,
      width: chip.width,
      height: size + padY * 2 - 1,
      color: options.background,
      opacity: options.opacity ?? 1,
    });
    ctx.page.drawText(chip.text, { x: chip.x + padX, y, size, font: ctx.fonts.body, color: options.textColor });
  }
  return startY - rows * lineHeight;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

function sidebarGeometry(ctx: RenderContext, side: 'left' | 'right' = 'left') {
  const sidebarWidth = ctx.pageWidth * 0.33;
  const padding = 24;
  if (side === 'left') {
    return {
      sidebarX: 0,
      sidebarWidth,
      innerX: padding,
      innerWidth: sidebarWidth - padding * 2,
      contentX: sidebarWidth + 26,
      contentWidth: ctx.pageWidth - sidebarWidth - 26 - 40,
    };
  }
  return {
    sidebarX: ctx.pageWidth - sidebarWidth,
    sidebarWidth,
    innerX: ctx.pageWidth - sidebarWidth + padding,
    innerWidth: sidebarWidth - padding * 2,
    contentX: 40,
    contentWidth: ctx.pageWidth - sidebarWidth - 26 - 40,
  };
}

function drawSidebarBand(ctx: RenderContext, continuation: boolean): void {
  const side = ctx.template.layout === 'sidebar-right' ? 'right' : 'left';
  const geo = sidebarGeometry(ctx, side);
  ctx.page.drawRectangle({ x: geo.sidebarX, y: 0, width: geo.sidebarWidth, height: ctx.pageHeight, color: ctx.palette.accent });
  if (continuation) {
    const name = ctx.template.headingCase === 'upper' ? ctx.resumeName.toUpperCase() : ctx.resumeName;
    ctx.page.drawText(sanitize(name, ctx.asciiOnly), {
      x: geo.innerX,
      y: ctx.pageHeight - 36,
      size: 10.5,
      font: ctx.fonts.headingBold,
      color: ctx.palette.onAccent,
      opacity: 0.9,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Section renderers                                                   */
/* ------------------------------------------------------------------ */

function renderSummary(ctx: RenderContext, resume: ResumeJson): void {
  if (!sectionHasContent(resume, 'summary')) return;
  sectionHeading(ctx, 'Summary', 'summary');
  ctx.y = ctxText(ctx, resume.basics.summary) - ctx.sectionGap * 0.4;
}

function renderExperience(ctx: RenderContext, resume: ResumeJson, timeline = false): void {
  if (!sectionHasContent(resume, 'experience')) return;
  sectionHeading(ctx, 'Experience', 'experience');
  const { palette, fonts } = ctx;
  const typo = typography(ctx.template, ctx.settings);
  for (const item of resume.work) {
    const headerFont = fonts.bodyBold;
    const headerSize = typo.entryTitle;
    const dateText = dateRange(item.startDate, item.endDate);
    const dateWidth = dateText ? ctx.fonts.body.widthOfTextAtSize(sanitize(dateText, ctx.asciiOnly), typo.entryDate) + 8 : 0;
    const available = (timeline ? ctx.contentWidth - 86 : ctx.contentWidth) - dateWidth;
    const titleLines = wrapText(sanitize(item.position || item.name, ctx.asciiOnly), headerFont, headerSize, available);
    ensureSpace(ctx, titleLines.length * headerSize * 1.3 + 24);
    const startY = ctx.y;
    const x = timeline ? ctx.contentX + 86 : ctx.contentX;

    for (const line of titleLines) {
      ctx.page.drawText(line, { x, y: ctx.y, size: headerSize, font: headerFont, color: palette.text });
      ctx.y -= headerSize * 1.3;
    }
    if (item.name) {
      ctx.y = ctxText(ctx, `${item.name}${item.location ? ` · ${item.location}` : ''}`, {
        x,
        size: typo.entrySub,
        font: fonts.body,
        color: palette.accent,
        maxWidth: available,
      });
    } else if (item.location) {
      ctx.y = ctxText(ctx, item.location, { x, size: typo.entrySub, font: fonts.bodyItalic, color: palette.muted, maxWidth: available });
    }

    if (dateText) {
      const y = startY;
      ctx.page.drawText(sanitize(dateText, ctx.asciiOnly), {
        x: timeline ? ctx.contentX : ctx.contentX + ctx.contentWidth - ctx.fonts.body.widthOfTextAtSize(sanitize(dateText, ctx.asciiOnly), typo.entryDate),
        y,
        size: typo.entryDate,
        font: timeline ? ctx.fonts.bodyBold : ctx.fonts.body,
        color: timeline ? palette.text : palette.muted,
      });
    }
    if (timeline) {
      ctx.page.drawLine({ start: { x: x - 14, y: startY + 4 }, end: { x: x - 14, y: ctx.y + 2 }, thickness: 0.8, color: palette.line });
      ctx.page.drawCircle({ x: x - 14, y: startY + 4, size: 2.6, color: palette.accent });
    }

    if (item.summary) ctx.y = ctxText(ctx, item.summary, { color: palette.muted, size: typo.entryDesc, font: fonts.bodyItalic, maxWidth: ctx.contentWidth - (timeline ? 86 : 0) }) - 2;
    for (const highlight of item.highlights) bullet(ctx, highlight, { x: timeline ? ctx.contentX + 86 : ctx.contentX });
    ctx.y -= ctx.sectionGap * 0.55;
  }
  ctx.y -= ctx.sectionGap * 0.35;
}

function renderSkills(ctx: RenderContext, resume: ResumeJson, _compact = false): void {
  if (!sectionHasContent(resume, 'skills')) return;
  sectionHeading(ctx, 'Skills', 'skills');
  const { palette, fonts } = ctx;
  const typo = typography(ctx.template, ctx.settings);
  for (const group of resume.skills) {
    if (group.keywords.length === 0) continue;
    const category = sanitize(group.name, ctx.asciiOnly);
    const categoryWidth = fonts.bodyBold.widthOfTextAtSize(category, ctx.bodySize);
    // Stack the chips under long category names instead of running into them.
    const stacked = categoryWidth > ctx.contentWidth * 0.42;
    const chipsOffset = stacked ? 0 : Math.max(62, categoryWidth + 10);
    const chipsWidth = stacked ? ctx.contentWidth : Math.max(90, ctx.contentWidth - chipsOffset);

    ctx.page.drawText(category, { x: ctx.contentX, y: ctx.y, size: ctx.bodySize, font: fonts.bodyBold, color: palette.text });
    if (stacked) ctx.y -= ctx.bodySize * 1.35;

    ctx.y = drawChips(ctx, group.keywords, {
      x: ctx.contentX + chipsOffset,
      y: ctx.y,
      maxWidth: chipsWidth,
      background: rgb(0.945, 0.949, 0.965),
      textColor: palette.text,
      size: typo.chipSize,
    });
    ctx.y -= 4;
  }
  ctx.y -= ctx.sectionGap * 0.4;
}

function renderProjects(ctx: RenderContext, resume: ResumeJson): void {
  if (!sectionHasContent(resume, 'projects')) return;
  sectionHeading(ctx, 'Projects', 'projects');
  const typo = typography(ctx.template, ctx.settings);
  for (const project of resume.projects) {
    ensureSpace(ctx, 20);
    const startY = ctx.y;
    if (project.url) {
      const url = sanitize(project.url.replace(/^https?:\/\//, ''), ctx.asciiOnly);
      const urlWidth = ctx.fonts.body.widthOfTextAtSize(url, typo.entryDate);
      const urlX = ctx.contentX + ctx.contentWidth - urlWidth;
      ctx.page.drawText(url, {
        x: urlX,
        y: startY,
        size: typo.entryDate,
        font: ctx.fonts.body,
        color: ctx.palette.muted,
      });
      linkAnnotation(ctx, project.url, urlX, startY, urlWidth, typo.entryDate);
    }
    ctx.y = ctxText(ctx, project.name, { font: ctx.fonts.bodyBold, size: typo.entryTitle, maxWidth: ctx.contentWidth - 120 });
    if (project.description) ctx.y = ctxText(ctx, project.description, { color: ctx.palette.muted, size: typo.entryDesc, font: ctx.fonts.bodyItalic });
    for (const highlight of project.highlights.slice(0, 4)) bullet(ctx, highlight);
    if (project.keywords.length > 0) {
      ctx.y = ctxText(ctx, project.keywords.join(' · '), { font: ctx.fonts.bodyItalic, color: ctx.palette.muted, size: ctx.bodySize - 0.8 }) - 2;
    }
    ctx.y -= ctx.sectionGap * 0.5;
  }
  ctx.y -= ctx.sectionGap * 0.3;
}

function renderEducation(ctx: RenderContext, resume: ResumeJson, timeline = false): void {
  if (!sectionHasContent(resume, 'education')) return;
  sectionHeading(ctx, 'Education', 'education');
  const typo = typography(ctx.template, ctx.settings);
  for (const item of resume.education) {
    const dates = dateRange(item.startDate, item.endDate);
    ensureSpace(ctx, 24);
    const startY = ctx.y;
    const x = timeline ? ctx.contentX + 86 : ctx.contentX;
    const degree = [item.studyType, item.area].filter(Boolean).join(', ') || item.institution;
    ctx.y = ctxText(ctx, degree, { x, font: ctx.fonts.bodyBold, size: typo.entryTitle, maxWidth: ctx.contentWidth - (timeline ? 86 : 0) - 80 });
    ctx.y = ctxText(ctx, `${item.institution}${item.score ? ` · ${item.score}` : ''}`, { x, size: typo.entrySub, color: ctx.palette.accent, maxWidth: ctx.contentWidth - (timeline ? 86 : 0) - 80 });
    if (dates) {
      const text = sanitize(dates, ctx.asciiOnly);
      ctx.page.drawText(text, {
        x: timeline ? ctx.contentX : ctx.contentX + ctx.contentWidth - ctx.fonts.body.widthOfTextAtSize(text, typo.entryDate),
        y: startY,
        size: typo.entryDate,
        font: timeline ? ctx.fonts.bodyBold : ctx.fonts.body,
        color: timeline ? ctx.palette.text : ctx.palette.muted,
      });
    }
    for (const highlight of item.courses.slice(0, 3)) bullet(ctx, highlight, { x });
    ctx.y -= ctx.sectionGap * 0.45;
  }
  ctx.y -= ctx.sectionGap * 0.3;
}

function renderCertifications(ctx: RenderContext, resume: ResumeJson): void {
  if (!sectionHasContent(resume, 'certifications')) return;
  sectionHeading(ctx, 'Certifications', 'certifications');
  for (const cert of resume.certificates) {
    const date = cert.date ? ` (${cert.date.slice(0, 4)})` : '';
    ctx.y = ctxText(ctx, `${cert.name}${cert.issuer ? ` - ${cert.issuer}` : ''}${date}`, { maxWidth: ctx.contentWidth });
  }
  ctx.y -= ctx.sectionGap * 0.4;
}

function renderAwards(ctx: RenderContext, resume: ResumeJson): void {
  if (!sectionHasContent(resume, 'awards')) return;
  sectionHeading(ctx, 'Awards', 'awards');
  for (const award of resume.awards) {
    ctx.y = ctxText(ctx, `${award.title}${award.awarder ? ` - ${award.awarder}` : ''}${award.date ? ` (${award.date.slice(0, 4)})` : ''}`);
  }
  ctx.y -= ctx.sectionGap * 0.4;
}

function renderLanguages(ctx: RenderContext, resume: ResumeJson): void {
  if (!sectionHasContent(resume, 'languages')) return;
  sectionHeading(ctx, 'Languages', 'languages');
  ctx.y = ctxText(ctx, resume.languages.map((language) => `${language.language} (${language.fluency})`).join(' · '));
  ctx.y -= ctx.sectionGap * 0.4;
}

function renderSection(ctx: RenderContext, resume: ResumeJson, section: SectionId, timeline: boolean): void {
  switch (section) {
    case 'summary':
      renderSummary(ctx, resume);
      break;
    case 'experience':
      renderExperience(ctx, resume, timeline);
      break;
    case 'skills':
      renderSkills(ctx, resume);
      break;
    case 'projects':
      renderProjects(ctx, resume);
      break;
    case 'education':
      renderEducation(ctx, resume, timeline);
      break;
    case 'certifications':
      renderCertifications(ctx, resume);
      break;
    case 'awards':
      renderAwards(ctx, resume);
      break;
    case 'languages':
      renderLanguages(ctx, resume);
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Headers                                                             */
/* ------------------------------------------------------------------ */

function renderStandardHeader(ctx: RenderContext, resume: ResumeJson, centered: boolean): void {
  const { palette, fonts, template } = ctx;
  const typo = typography(template, ctx.settings);

  const drawWrapped = (text: string, options: { size: number; font: PDFFont; color: RGB; lineHeight: number; maxWidth?: number; gapAfter?: number }): void => {
    const lines = wrapText(text, options.font, options.size, options.maxWidth ?? ctx.contentWidth);
    for (const line of lines) {
      const width = options.font.widthOfTextAtSize(line, options.size);
      ctx.page.drawText(line, {
        x: centered ? ctx.contentX + (ctx.contentWidth - width) / 2 : ctx.contentX,
        y: ctx.y,
        size: options.size,
        font: options.font,
        color: options.color,
      });
      ctx.y -= options.size * options.lineHeight;
    }
    if (options.gapAfter) ctx.y -= options.gapAfter;
  };

  drawWrapped(sanitize(resume.basics.name, ctx.asciiOnly), {
    size: typo.nameSize,
    font: fonts.headingBold,
    color: palette.text,
    lineHeight: 1.28,
  });
  if (resume.basics.label) {
    drawWrapped(sanitize(resume.basics.label, ctx.asciiOnly), {
      size: typo.headlineSize,
      font: fonts.body,
      color: palette.accent,
      lineHeight: 1.45,
      gapAfter: 2,
    });
  }
  drawInlineSegments(ctx, contactSegments(resume, ctx), {
    centered,
    size: typo.metaSize,
    color: palette.muted,
    separator: '  ·  ',
    lineHeight: 1.55,
  });
  if (resume.basics.profiles.length > 0) {
    drawInlineSegments(ctx, linkSegments(resume, ctx), {
      centered,
      size: typo.metaSize,
      color: palette.accent,
      lineHeight: 1.6,
    });
  }
  if (template.divider !== 'none') {
    ctx.page.drawLine({ start: { x: ctx.contentX, y: ctx.y + 4 }, end: { x: ctx.contentX + ctx.contentWidth, y: ctx.y + 4 }, thickness: 0.9, color: palette.accent });
    ctx.y -= ctx.sectionGap * 0.9;
  } else {
    ctx.y -= ctx.sectionGap * 0.4;
  }
}

function renderModernHeader(ctx: RenderContext, resume: ResumeJson): void {
  const { palette, fonts } = ctx;
  const bandHeight = 106;
  ctx.page.drawRectangle({ x: 0, y: ctx.pageHeight - bandHeight, width: ctx.pageWidth, height: bandHeight, color: palette.accent });
  const maxWidth = ctx.pageWidth - ctx.margin * 2;
  let y = ctx.pageHeight - 44;
  const drawLines = (text: string, size: number, font: PDFFont, opacity: number, lineHeight: number) => {
    for (const line of wrapText(text, font, size, maxWidth)) {
      ctx.page.drawText(line, { x: ctx.margin, y, size, font, color: palette.onAccent, opacity });
      y -= size * lineHeight;
    }
  };

  drawLines(sanitize(resume.basics.name, ctx.asciiOnly), 24, fonts.headingBold, 1, 1.25);
  if (resume.basics.label) drawLines(sanitize(resume.basics.label, ctx.asciiOnly), 10.5, fonts.body, 0.92, 1.45);
  ctx.y = y;
  drawInlineSegments(
    ctx,
    contactSegments(resume, ctx).map((segment) => ({ ...segment, color: palette.onAccent, opacity: 0.88 })),
    { centered: false, size: 9.4, color: palette.onAccent, maxWidth },
  );
  if (resume.basics.profiles.length > 0) {
    drawInlineSegments(
      ctx,
      linkSegments(resume, ctx).map((segment) => ({ ...segment, color: palette.onAccent, opacity: 0.8 })),
      { centered: false, size: 8.6, color: palette.onAccent, maxWidth },
    );
  }
  ctx.y = ctx.pageHeight - bandHeight - 22;
}

function renderSidebarHeader(ctx: RenderContext, resume: ResumeJson, geo: ReturnType<typeof sidebarGeometry>): void {
  const { palette, fonts } = ctx;
  const nameLines = wrapText(sanitize(resume.basics.name, ctx.asciiOnly), fonts.headingBold, 19, geo.innerWidth);
  let y = ctx.pageHeight - ctx.margin - 8;
  for (const line of nameLines) {
    ctx.page.drawText(line, { x: geo.innerX, y, size: 19, font: fonts.headingBold, color: palette.onAccent });
    y -= 24;
  }
  if (resume.basics.label) {
    const labelLines = wrapText(sanitize(resume.basics.label, ctx.asciiOnly), fonts.body, 9.6, geo.innerWidth);
    for (const line of labelLines) {
      ctx.page.drawText(line, { x: geo.innerX, y, size: 9.6, font: fonts.body, color: palette.onAccent, opacity: 0.9 });
      y -= 13;
    }
  }
  y -= 6;
  ctx.page.drawLine({ start: { x: geo.innerX, y: y + 6 }, end: { x: geo.innerX + geo.innerWidth, y: y + 6 }, thickness: 0.8, color: palette.onAccent, opacity: 0.4 });
  y -= 16;
  const contact = [resume.basics.email, resume.basics.phone, resume.basics.location.city, resume.basics.location.countryCode].filter(Boolean) as string[];
  for (const item of contact) {
    const lines = wrapText(sanitize(item, ctx.asciiOnly), fonts.body, 8.8, geo.innerWidth);
    if (item === resume.basics.email && lines.length > 0) {
      const width = fonts.body.widthOfTextAtSize(lines[0], 8.8);
      linkAnnotation(ctx, `mailto:${item}`, geo.innerX, y, width, 8.8);
    }
    for (const line of lines) {
      ctx.page.drawText(line, { x: geo.innerX, y, size: 8.8, font: fonts.body, color: palette.onAccent, opacity: 0.92 });
      y -= 12;
    }
  }
  for (const profile of resume.basics.profiles) {
    const lines = wrapText(sanitize(profile.url.replace(/^https?:\/\//, ''), ctx.asciiOnly), fonts.body, 8.4, geo.innerWidth);
    for (const line of lines) {
      const width = fonts.body.widthOfTextAtSize(line, 8.4);
      linkAnnotation(ctx, profile.url, geo.innerX, y, width, 8.4);
      ctx.page.drawText(line, { x: geo.innerX, y, size: 8.4, font: fonts.body, color: palette.onAccent, opacity: 0.85 });
      y -= 11;
    }
  }
  ctx.sidebarY = y - 14;
}

function renderSidebarSections(ctx: RenderContext, resume: ResumeJson, geo: ReturnType<typeof sidebarGeometry>, sections: SectionId[]): void {
  const { palette, fonts } = ctx;
  let y = ctx.sidebarY ?? ctx.pageHeight - ctx.margin;
  const drawHeading = (label: string) => {
    const text = ctx.template.headingCase === 'upper' ? label.toUpperCase() : label;
    y -= 12;
    ctx.page.drawText(sanitize(text, ctx.asciiOnly), { x: geo.innerX, y, size: 9, font: fonts.headingBold, color: palette.onAccent });
    y -= 6;
    ctx.page.drawLine({ start: { x: geo.innerX, y }, end: { x: geo.innerX + geo.innerWidth, y }, thickness: 0.6, color: palette.onAccent, opacity: 0.35 });
    y -= 15;
  };
  const drawLines = (text: string, size = 8.6, opacity = 0.92) => {
    for (const line of wrapText(sanitize(text, ctx.asciiOnly), fonts.body, size, geo.innerWidth)) {
      if (y < ctx.margin) return;
      ctx.page.drawText(line, { x: geo.innerX, y, size, font: fonts.body, color: palette.onAccent, opacity });
      y -= size * 1.34;
    }
  };

  for (const section of sections) {
    if (!sectionHasContent(resume, section)) continue;
    if (y < ctx.margin + 40) break;
    switch (section) {
      case 'skills':
        drawHeading('Skills');
        for (const group of resume.skills) {
          if (y < ctx.margin + 24) break;
          ctx.page.drawText(sanitize(group.name, ctx.asciiOnly), { x: geo.innerX, y, size: 8.6, font: fonts.bodyBold, color: palette.onAccent, opacity: 0.95 });
          y -= 12;
          y = drawChips(ctx, group.keywords, {
            x: geo.innerX,
            y,
            maxWidth: geo.innerWidth,
            background: rgb(1, 1, 1),
            textColor: palette.onAccent,
            opacity: 0.16,
            size: 8.4,
          });
          y -= 5;
        }
        break;
      case 'languages':
        drawHeading('Languages');
        for (const language of resume.languages) {
          drawLines(`${language.language} - ${language.fluency}`, 8.4);
        }
        break;
      case 'certifications':
        drawHeading('Certifications');
        for (const cert of resume.certificates) {
          drawLines(`${cert.name}${cert.date ? ` (${cert.date.slice(0, 4)})` : ''}`, 8.4);
          y -= 3;
        }
        break;
      case 'awards':
        drawHeading('Awards');
        for (const award of resume.awards) {
          drawLines(`${award.title}${award.date ? ` (${award.date.slice(0, 4)})` : ''}`, 8.4);
          y -= 3;
        }
        break;
      default:
        break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Layouts                                                             */
/* ------------------------------------------------------------------ */

function baseContext(
  doc: PDFDocument,
  resume: ResumeJson,
  template: ResumeTemplate,
  settings: DocumentSettings,
  fonts: FontSet,
  asciiOnly: boolean,
): RenderContext {
  const [pageWidth, pageHeight] = PAGE_SIZES[settings.pageSize];
  const palette: Palette = {
    accent: hexToRgb(settings.accentOverride ?? template.accent),
    accentSoft: mixColor(hexToRgb(settings.accentOverride ?? template.accent), rgb(1, 1, 1), 0.86),
    text: rgb(0.13, 0.15, 0.19),
    muted: rgb(0.42, 0.45, 0.5),
    line: rgb(0.84, 0.85, 0.88),
    onAccent: hexToRgb(template.accentText ?? '#ffffff'),
  };
  const typo = typography(template, settings);
  const page = doc.addPage([pageWidth, pageHeight]);
  return {
    doc,
    page,
    fonts,
    palette,
    template,
    settings,
    asciiOnly,
    pageWidth,
    pageHeight,
    margin: typo.margin,
    y: pageHeight - typo.margin,
    contentX: typo.margin,
    contentWidth: pageWidth - typo.margin * 2,
    bodySize: typo.bodySize,
    lineHeight: typo.lineHeight,
    sectionGap: typo.sectionGap,
    sidebarY: pageHeight - typo.margin,
    resumeName: resume.basics.name,
  };
}

export async function renderResumePdf(resume: ResumeJson, template: ResumeTemplate, settings: DocumentSettings): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${resume.basics.name} - Resume`);
  doc.setAuthor(resume.basics.name);
  doc.setProducer('JobPal');
  doc.setCreator('JobPal');
  const { fonts, asciiOnly } = await embedFonts(doc, template, settings);
  const ctx = baseContext(doc, resume, template, settings, fonts, asciiOnly);
  const order = effectiveSectionOrder(template, settings);
  const layout = template.layout;
  const timeline = layout === 'timeline';

  if (layout === 'modern-header') {
    renderModernHeader(ctx, resume);
    for (const section of order) renderSection(ctx, resume, section, false);
    return doc.save();
  }

  if (layout === 'sidebar-left' || layout === 'sidebar-right') {
    const side = layout === 'sidebar-right' ? 'right' : 'left';
    const geo = sidebarGeometry(ctx, side);
    drawSidebarBand(ctx, false);
    ctx.contentX = geo.contentX;
    ctx.contentWidth = geo.contentWidth;
    const sidebarSections: SectionId[] = order.filter((section) => ['skills', 'languages', 'certifications', 'awards'].includes(section));
    const mainSections = order.filter((section) => !sidebarSections.includes(section));
    renderSidebarHeader(ctx, resume, geo);
    renderSidebarSections(ctx, resume, geo, sidebarSections);
    for (const section of mainSections) renderSection(ctx, resume, section, false);
    return doc.save();
  }

  if (layout === 'two-column') {
    const mainWidth = ctx.contentWidth * 0.62;
    const railX = ctx.contentX + ctx.contentWidth * 0.67;
    const railWidth = ctx.contentWidth * 0.33;
    renderStandardHeader(ctx, resume, false);
    const railSections = order.filter((section) => ['skills', 'education', 'certifications', 'languages', 'awards'].includes(section));
    const mainSections = order.filter((section) => !railSections.includes(section));
    const mainX = ctx.contentX;
    for (const section of mainSections) {
      ctx.contentWidth = mainWidth;
      renderSection(ctx, resume, section, false);
    }
    const afterMainY = ctx.y;
    ctx.y = afterMainY;
    for (const section of railSections) {
      ctx.contentX = railX;
      ctx.contentWidth = railWidth;
      renderSection(ctx, resume, section, false);
      if (ctx.y < ctx.margin * 0.7) break;
    }
    ctx.contentX = mainX;
    ctx.contentWidth = ctx.pageWidth - ctx.margin * 2;
    return doc.save();
  }

  const centered = layout === 'classic' || layout === 'compact';
  renderStandardHeader(ctx, resume, centered);
  for (const section of order) renderSection(ctx, resume, section, timeline);
  return doc.save();
}

export async function renderCoverLetterPdf(
  resume: ResumeJson,
  template: ResumeTemplate,
  settings: DocumentSettings,
  body: string,
  _target?: { title?: string; company?: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${resume.basics.name} - Cover Letter`);
  doc.setProducer('JobPal');
  const { fonts, asciiOnly } = await embedFonts(doc, template, settings);
  const ctx = baseContext(doc, resume, template, settings, fonts, asciiOnly);

  // Cover letter header mirrors the HTML template exactly (22pt name, accent label, accent rule).
  const name = sanitize(resume.basics.name, asciiOnly);
  ctx.page.drawText(name, { x: ctx.contentX, y: ctx.y, size: 22, font: fonts.headingBold, color: ctx.palette.text });
  ctx.y -= 22 * 1.3;
  if (resume.basics.label) {
    ctx.page.drawText(sanitize(resume.basics.label, asciiOnly), { x: ctx.contentX, y: ctx.y, size: 11, font: fonts.body, color: ctx.palette.accent });
    ctx.y -= 11 * 1.6;
  }
  const metaSize = 9.4;
  drawInlineSegments(ctx, contactSegments(resume, ctx), {
    centered: false,
    size: metaSize,
    color: ctx.palette.muted,
    separator: '  ·  ',
    lineHeight: 1.55,
  });
  if (resume.basics.profiles.length > 0) {
    drawInlineSegments(ctx, linkSegments(resume, ctx), {
      centered: false,
      size: metaSize,
      color: ctx.palette.accent,
      lineHeight: 1.6,
    });
  }
  ctx.y -= 14.2;
  ctx.page.drawLine({ start: { x: ctx.contentX, y: ctx.y }, end: { x: ctx.contentX + ctx.contentWidth, y: ctx.y }, thickness: 1.5, color: ctx.palette.accent });
  ctx.y -= 14.2;

  const dateText = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  ctx.y = ctxText(ctx, dateText, { size: 10.4, color: ctx.palette.muted }) - ctx.sectionGap * 0.8;

  const paragraphs = body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  for (const paragraph of paragraphs) {
    const lines = wrapText(sanitize(paragraph, ctx.asciiOnly), ctx.fonts.body, 11, ctx.contentWidth);
    ensureSpace(ctx, lines.length * 11 * 1.55 + 10);
    for (const line of lines) {
      ctx.page.drawText(line, { x: ctx.contentX, y: ctx.y, size: 11, font: ctx.fonts.body, color: ctx.palette.text });
      ctx.y -= 11 * 1.55;
    }
    ctx.y -= 11 * 1.1;
  }
  return doc.save();
}

export interface PlainDoc {
  title: string;
  subtitle?: string;
  sections: { heading: string; lines: string[]; bullets?: boolean[] }[];
}

export async function renderPlainPdf(
  plain: PlainDoc,
  template: ResumeTemplate,
  settings: DocumentSettings,
  contact?: ResumeJson['basics'],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { fonts, asciiOnly } = await embedFonts(doc, template, settings);
  const resumeStub: ResumeJson = {
    $schema: '',
    basics: contact ?? { name: '', label: '', email: '', phone: '', url: '', summary: '', location: {}, profiles: [] },
    work: [],
    education: [],
    skills: [],
    projects: [],
    certificates: [],
    awards: [],
    languages: [],
    meta: { version: '', generator: 'JobPal', template: template.id, generatedAt: new Date().toISOString() },
  };
  const ctx = baseContext(doc, resumeStub, template, settings, fonts, asciiOnly);
  const name = sanitize(plain.title, asciiOnly);
  ctx.page.drawText(name, { x: ctx.contentX, y: ctx.y, size: typography(template, settings).nameSize, font: fonts.headingBold, color: ctx.palette.text });
  ctx.y -= typography(template, settings).nameSize * 1.4;
  if (plain.subtitle) {
    ctx.y = ctxText(ctx, plain.subtitle, { color: ctx.palette.accent }) - ctx.sectionGap * 0.6;
  }
  for (const section of plain.sections) {
    sectionHeading(ctx, section.heading, 'summary');
    for (const [index, line] of section.lines.entries()) {
      if (section.bullets?.[index]) bullet(ctx, line);
      else ctx.y = ctxText(ctx, line) - 2;
    }
    ctx.y -= ctx.sectionGap * 0.5;
  }
  return doc.save();
}
