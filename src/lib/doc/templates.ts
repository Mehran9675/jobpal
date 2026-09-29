import type { ResumeTemplate, SectionId, TemplateLayout } from '@/types';

const ORDER_STANDARD: SectionId[] = ['summary', 'experience', 'skills', 'projects', 'education', 'certifications', 'awards', 'languages'];
const ORDER_ACADEMIC: SectionId[] = ['summary', 'education', 'experience', 'skills', 'projects', 'certifications', 'awards', 'languages'];
const ORDER_SKILLS_FIRST: SectionId[] = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'awards', 'languages'];

function template(
  id: string,
  name: string,
  description: string,
  layout: TemplateLayout,
  accent: string,
  options: Partial<ResumeTemplate> = {},
): ResumeTemplate {
  return {
    id,
    name,
    description,
    layout,
    accent,
    accentText: options.accentText ?? '#ffffff',
    font: options.font ?? 'sans',
    headingCase: options.headingCase ?? 'upper',
    divider: options.divider ?? 'line',
    density: options.density ?? 'comfortable',
    sectionOrder: options.sectionOrder ?? ORDER_STANDARD,
    atsScore: options.atsScore ?? 90,
    tags: options.tags ?? [],
  };
}

/**
 * Curated design catalogue. Every template is machine-readable (JSON Resume
 * compatible) and ATS-tested in the sense that content order stays linear in
 * single-column layouts.
 */
export const RESUME_TEMPLATES: ResumeTemplate[] = [
  template('essential', 'Essential', 'Clean single column, restrained rules and generous spacing — minimal and professional by default.', 'minimal', '#334155', {
    tags: ['minimal', 'professional', 'ats', 'default'],
    divider: 'line',
    headingCase: 'upper',
    atsScore: 99,
  }),
  template('aurora', 'Aurora', 'Left sidebar with accent panel — modern and confident.', 'sidebar-left', '#6366f1', {
    tags: ['modern', 'two-tone', 'popular'],
    atsScore: 86,
    divider: 'none',
  }),
  template('atlas', 'Atlas', 'Timeless single-column layout with ruled section headings.', 'classic', '#1e3a8a', {
    tags: ['classic', 'corporate', 'ats'],
    font: 'serif',
    atsScore: 99,
  }),
  template('bloom', 'Bloom', 'Airy minimal design with generous whitespace.', 'minimal', '#db2777', {
    tags: ['minimal', 'creative'],
    divider: 'dot',
    atsScore: 95,
  }),
  template('carbon', 'Carbon', 'Dense and data-rich, ideal for long careers.', 'compact', '#111827', {
    tags: ['compact', 'technical'],
    density: 'compact',
    atsScore: 97,
  }),
  template('cascade', 'Cascade', 'Two-column body with a skills rail.', 'two-column', '#0d9488', {
    tags: ['modern', 'two-column'],
    atsScore: 88,
  }),
  template('chronos', 'Chronos', 'Timeline gutter that makes career progression obvious.', 'timeline', '#b45309', {
    tags: ['timeline', 'distinctive'],
    atsScore: 90,
  }),
  template('delta', 'Delta', 'Sharp single column with bold accent bars.', 'classic', '#2563eb', {
    tags: ['classic', 'engineering'],
    divider: 'bar',
    atsScore: 98,
  }),
  template('ember', 'Ember', 'Right-hand sidebar for a warmer, editorial feel.', 'sidebar-right', '#ea580c', {
    tags: ['warm', 'editorial'],
    atsScore: 86,
  }),
  template('fable', 'Fable', 'Academic serif layout built for research CVs.', 'classic', '#7f1d1d', {
    tags: ['academic', 'cv', 'serif'],
    font: 'serif',
    sectionOrder: ORDER_ACADEMIC,
    atsScore: 97,
  }),
  template('graphite', 'Graphite', 'Monochrome minimalism for design-minded candidates.', 'minimal', '#374151', {
    tags: ['monochrome', 'minimal'],
    divider: 'none',
    atsScore: 96,
  }),
  template('horizon', 'Horizon', 'Full-width colour header with a clean body.', 'modern-header', '#7c3aed', {
    tags: ['modern', 'bold'],
    atsScore: 92,
  }),
  template('ivy', 'Ivy', 'Traditional serif with restrained green accents.', 'classic', '#166534', {
    tags: ['traditional', 'serif'],
    font: 'serif',
    headingCase: 'title',
    divider: 'line',
    atsScore: 98,
  }),
  template('juno', 'Juno', 'Sidebar layout with a technical skills focus.', 'sidebar-left', '#0891b2', {
    tags: ['technical', 'skills-first'],
    sectionOrder: ORDER_SKILLS_FIRST,
    divider: 'none',
    atsScore: 87,
  }),
  template('kite', 'Kite', 'Compact single column that fits a lot on one page.', 'compact', '#475569', {
    tags: ['compact', 'one-page'],
    density: 'compact',
    divider: 'bar',
    atsScore: 98,
  }),
  template('lumen', 'Lumen', 'Gradient header with generous type hierarchy.', 'modern-header', '#9333ea', {
    tags: ['modern', 'creative'],
    atsScore: 91,
  }),
  template('meridian', 'Meridian', 'Two-column layout that keeps dates prominent.', 'two-column', '#3730a3', {
    tags: ['two-column', 'corporate'],
    atsScore: 88,
  }),
  template('nova', 'Nova', 'High-contrast minimal with a single accent rule.', 'minimal', '#c026d3', {
    tags: ['minimal', 'bold'],
    divider: 'bar',
    atsScore: 95,
  }),
  template('quill', 'Quill', 'Elegant mixed serif/sans pairing for senior roles.', 'classic', '#0f766e', {
    tags: ['elegant', 'senior'],
    font: 'mixed',
    headingCase: 'title',
    atsScore: 97,
  }),
];

export const TEMPLATE_MAP: Record<string, ResumeTemplate> = Object.fromEntries(RESUME_TEMPLATES.map((item) => [item.id, item]));

export function getTemplate(id: string | undefined): ResumeTemplate {
  return TEMPLATE_MAP[id ?? ''] ?? RESUME_TEMPLATES[0];
}

export function templatesByTag(): { tag: string; templates: ResumeTemplate[] }[] {
  const tags = new Map<string, ResumeTemplate[]>();
  for (const item of RESUME_TEMPLATES) {
    for (const tag of item.tags) {
      const list = tags.get(tag) ?? [];
      list.push(item);
      tags.set(tag, list);
    }
  }
  return [...tags.entries()].map(([tag, templates]) => ({ tag, templates }));
}

export const ACCENT_PRESETS = [
  '#6366f1',
  '#7c3aed',
  '#2563eb',
  '#0891b2',
  '#0d9488',
  '#166534',
  '#65a30d',
  '#b45309',
  '#ea580c',
  '#dc2626',
  '#db2777',
  '#9333ea',
  '#475569',
  '#111827',
];
