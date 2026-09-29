import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from 'docx';
import type { DocumentSettings, ResumeTemplate, SectionId } from '@/types';
import { contactLine, dateRange, effectiveSectionOrder, sectionHasContent, SECTION_LABELS, type ResumeJson } from './schema';
import { base64ToUint8 } from '@/lib/utils';

function hex(color: string): string {
  return color.replace('#', '').toUpperCase();
}

function accentOf(template: ResumeTemplate, settings: DocumentSettings): string {
  return hex(settings.accentOverride ?? template.accent);
}

function typography(template: ResumeTemplate, settings: DocumentSettings) {
  const density = settings.densityOverride ?? template.density;
  const compact = density === 'compact';
  return { size: compact ? 18 : 20, headingSize: compact ? 20 : 22, nameSize: compact ? 40 : 46, spacing: compact ? 80 : 120 };
}

function sectionHeading(text: string, color: string, typo: ReturnType<typeof typography>, divider: ResumeTemplate['divider']): Paragraph {
  const label = text.toUpperCase();
  return new Paragraph({
    spacing: { before: typo.spacing * 1.4, after: typo.spacing * 0.6 },
    border: divider === 'none' ? undefined : { bottom: { style: BorderStyle.SINGLE, size: divider === 'bar' ? 12 : 6, color, space: 4 } },
    children: [new TextRun({ text: label, bold: true, size: typo.headingSize, color, font: 'Calibri' })],
  });
}

function bullets(items: string[], typo: ReturnType<typeof typography>): Paragraph[] {
  return items.map(
    (item) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: typo.spacing * 0.4 },
        children: [new TextRun({ text: item, size: typo.size })],
      }),
  );
}

export async function renderResumeDocx(resume: ResumeJson, template: ResumeTemplate, settings: DocumentSettings): Promise<Uint8Array> {
  const accent = accentOf(template, settings);
  const typo = typography(template, settings);
  const order = effectiveSectionOrder(template, settings);
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: template.layout === 'classic' || template.layout === 'compact' ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({ text: resume.basics.name, bold: true, size: typo.nameSize, color: '111827', font: 'Calibri' })],
    }),
  );
  if (resume.basics.label) {
    children.push(
      new Paragraph({
        alignment: template.layout === 'classic' || template.layout === 'compact' ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 60 },
        children: [new TextRun({ text: resume.basics.label, size: typo.size + 2, color: accent })],
      }),
    );
  }
  children.push(
    new Paragraph({
      alignment: template.layout === 'classic' || template.layout === 'compact' ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({ text: contactLine(resume), size: typo.size - 2, color: '6B7280' })],
    }),
  );
  if (resume.basics.profiles.length > 0) {
    children.push(
      new Paragraph({
        alignment: template.layout === 'classic' || template.layout === 'compact' ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 160 },
        children: resume.basics.profiles.flatMap((profile, index) => [
          ...(index > 0 ? [new TextRun({ text: '   ', size: typo.size - 2 })] : []),
          new ExternalHyperlink({
            link: profile.url,
            children: [new TextRun({ text: profile.url.replace(/^https?:\/\//, ''), size: typo.size - 2, color: accent, underline: {} })],
          }),
        ]),
      }),
    );
  }

  const renderSection = (section: SectionId): void => {
    if (!sectionHasContent(resume, section)) return;
    children.push(sectionHeading(SECTION_LABELS[section], accent, typo, template.divider));
    switch (section) {
      case 'summary':
        children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: resume.basics.summary, size: typo.size })] }));
        break;
      case 'experience':
        for (const item of resume.work) {
          children.push(
            new Paragraph({
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              spacing: { after: 20 },
              children: [
                new TextRun({ text: item.position || item.name, bold: true, size: typo.size + 2 }),
                ...(dateRange(item.startDate, item.endDate)
                  ? [new TextRun({ text: `\t${dateRange(item.startDate, item.endDate)}`, size: typo.size - 2, color: '6B7280' })]
                  : []),
              ],
            }),
          );
          if (item.name) {
            children.push(
              new Paragraph({
                spacing: { after: 40 },
                children: [new TextRun({ text: `${item.name}${item.location ? ` · ${item.location}` : ''}`, size: typo.size, color: accent })],
              }),
            );
          }
          if (item.summary) {
            children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: item.summary, size: typo.size, italics: true, color: '4B5563' })] }));
          }
          children.push(...bullets(item.highlights, typo));
          children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        }
        break;
      case 'skills':
        for (const group of resume.skills) {
          children.push(
            new Paragraph({
              spacing: { after: 40 },
              children: [
                new TextRun({ text: `${group.name}: `, bold: true, size: typo.size }),
                new TextRun({ text: group.keywords.join(', '), size: typo.size }),
              ],
            }),
          );
        }
        break;
      case 'projects':
        for (const project of resume.projects) {
          children.push(
            new Paragraph({
              spacing: { after: 20 },
              children: [
                new TextRun({ text: project.name, bold: true, size: typo.size + 2 }),
                ...(project.url ? [new TextRun({ text: `  ${project.url}`, size: typo.size - 2, color: accent })] : []),
              ],
            }),
          );
          if (project.description) {
            children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: project.description, size: typo.size })] }));
          }
          children.push(...bullets(project.highlights, typo));
          children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        }
        break;
      case 'education':
        for (const item of resume.education) {
          children.push(
            new Paragraph({
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              spacing: { after: 20 },
              children: [
                new TextRun({ text: [item.studyType, item.area].filter(Boolean).join(', ') || item.institution, bold: true, size: typo.size + 2 }),
                ...(dateRange(item.startDate, item.endDate)
                  ? [new TextRun({ text: `\t${dateRange(item.startDate, item.endDate)}`, size: typo.size - 2, color: '6B7280' })]
                  : []),
              ],
            }),
          );
          children.push(
            new Paragraph({
              spacing: { after: 60 },
              children: [new TextRun({ text: `${item.institution}${item.score ? ` · ${item.score}` : ''}`, size: typo.size, color: accent })],
            }),
          );
        }
        break;
      case 'certifications':
        for (const cert of resume.certificates) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 20 },
              children: [new TextRun({ text: `${cert.name}${cert.issuer ? ` — ${cert.issuer}` : ''}${cert.date ? ` (${cert.date.slice(0, 4)})` : ''}`, size: typo.size })],
            }),
          );
        }
        break;
      case 'awards':
        for (const award of resume.awards) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 20 },
              children: [new TextRun({ text: `${award.title}${award.awarder ? ` — ${award.awarder}` : ''}`, size: typo.size })],
            }),
          );
        }
        break;
      case 'languages':
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: resume.languages.map((language) => `${language.language} (${language.fluency})`).join(' · '), size: typo.size })],
          }),
        );
        break;
      default:
        break;
    }
  };

  for (const section of order) renderSection(section);

  const document = new Document({
    creator: 'JobPal',
    title: `${resume.basics.name} — Resume`,
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: typo.size } },
        heading1: { run: { size: typo.headingSize, bold: true, color: accent }, paragraph: { spacing: { before: 200, after: 80 } } },
      },
    },
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const base64 = await Packer.toBase64String(document);
  return base64ToUint8(base64);
}

export async function renderPlainDocx(
  plain: { title: string; subtitle?: string; sections: { heading: string; lines: string[] }[] },
  template: ResumeTemplate,
  settings: DocumentSettings,
): Promise<Uint8Array> {
  const accent = accentOf(template, settings);
  const typo = typography(template, settings);
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: plain.title, bold: true, size: typo.nameSize - 8, color: '111827' })],
    }),
  ];
  if (plain.subtitle) {
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: plain.subtitle, size: typo.size + 2, color: accent })],
      }),
    );
  }
  for (const section of plain.sections) {
    children.push(sectionHeading(section.heading, accent, typo, template.divider));
    for (const line of section.lines) {
      children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: line, size: typo.size })] }));
    }
  }
  const document = new Document({ creator: 'JobPal', title: plain.title, sections: [{ children }] });
  const base64 = await Packer.toBase64String(document);
  return base64ToUint8(base64);
}

export async function renderCoverLetterDocx(
  resume: ResumeJson,
  template: ResumeTemplate,
  settings: DocumentSettings,
  body: string,
  _target?: { title?: string; company?: string },
): Promise<Uint8Array> {
  const accent = accentOf(template, settings);
  const typo = typography(template, settings);
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: resume.basics.name, bold: true, size: typo.nameSize, color: '111827' })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: contactLine(resume), size: typo.size - 2, color: '6B7280' })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), size: typo.size, color: '6B7280' })],
    }),
  ];
  for (const paragraph of body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    const isSignature = /^sincerely|^regards|^best,?$/i.test(paragraph) || paragraph === resume.basics.name;
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: paragraph.split('\n').flatMap((line, index) => [
          ...(index > 0 ? [new TextRun({ break: 1 })] : []),
          new TextRun({ text: line, size: typo.size + 2, bold: isSignature }),
        ]),
      }),
    );
  }
  const document = new Document({ creator: 'JobPal', title: `${resume.basics.name} — Cover Letter`, sections: [{ children }] });
  const base64 = await Packer.toBase64String(document);
  return base64ToUint8(base64);
}
