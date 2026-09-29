import type { DocumentSettings, ResumeTemplate, SectionId } from '@/types';
import { contactLine, dateRange, effectiveSectionOrder, sectionHasContent, SECTION_LABELS, type ResumeJson } from './schema';
import { escapeHtml } from '@/lib/utils';

function accent(template: ResumeTemplate, settings: DocumentSettings): string {
  return settings.accentOverride ?? template.accent;
}

function fontStack(template: ResumeTemplate): string {
  if (template.font === 'serif') return 'Georgia, "Times New Roman", Cambria, serif';
  if (template.font === 'mixed') return '"Helvetica Neue", Inter, Arial, sans-serif';
  return 'Inter, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
}

function headingCss(template: ResumeTemplate): string {
  return `
    .section-title { ${template.headingCase === 'upper' ? 'text-transform: uppercase; letter-spacing: 0.08em;' : ''} }
  `;
}

function sectionHtml(resume: ResumeJson, section: SectionId, timeline: boolean): string {
  if (!sectionHasContent(resume, section)) return '';
  const title = SECTION_LABELS[section];
  const body = (() => {
    switch (section) {
      case 'summary':
        return `<p class="summary">${escapeHtml(resume.basics.summary)}</p>`;
      case 'experience':
        return resume.work
          .map(
            (item) => `
          <article class="entry">
            <div class="entry-head">
              <div>
                <h3 class="entry-title">${escapeHtml(item.position || item.name)}</h3>
                <p class="entry-sub">${escapeHtml(item.name)}${item.location ? ` · ${escapeHtml(item.location)}` : ''}</p>
              </div>
              <span class="entry-date">${escapeHtml(dateRange(item.startDate, item.endDate))}</span>
            </div>
            ${item.summary ? `<p class="entry-desc">${escapeHtml(item.summary)}</p>` : ''}
            ${item.highlights.length > 0 ? `<ul>${item.highlights.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join('')}</ul>` : ''}
          </article>`,
          )
          .join('');
      case 'skills':
        return resume.skills
          .map(
            (group) => `
          <div class="skill-group">
            <span class="skill-cat">${escapeHtml(group.name)}</span>
            <span class="skill-items">${group.keywords.map((keyword) => `<span class="chip">${escapeHtml(keyword)}</span>`).join('')}</span>
          </div>`,
          )
          .join('');
      case 'projects':
        return resume.projects
          .map(
            (project) => `
          <article class="entry">
            <div class="entry-head">
              <h3 class="entry-title">${escapeHtml(project.name)}</h3>
              ${project.url ? `<span class="entry-date">${escapeHtml(project.url.replace(/^https?:\/\//, ''))}</span>` : ''}
            </div>
            ${project.description ? `<p class="entry-desc">${escapeHtml(project.description)}</p>` : ''}
            ${project.highlights.length > 0 ? `<ul>${project.highlights.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join('')}</ul>` : ''}
          </article>`,
          )
          .join('');
      case 'education':
        return resume.education
          .map(
            (item) => `
          <article class="entry">
            <div class="entry-head">
              <div>
                <h3 class="entry-title">${escapeHtml([item.studyType, item.area].filter(Boolean).join(', ') || item.institution)}</h3>
                <p class="entry-sub">${escapeHtml(item.institution)}${item.score ? ` · ${escapeHtml(item.score)}` : ''}</p>
              </div>
              <span class="entry-date">${escapeHtml(dateRange(item.startDate, item.endDate))}</span>
            </div>
          </article>`,
          )
          .join('');
      case 'certifications':
        return `<ul>${resume.certificates.map((cert) => `<li>${escapeHtml(cert.name)}${cert.issuer ? ` — ${escapeHtml(cert.issuer)}` : ''}${cert.date ? ` (${cert.date.slice(0, 4)})` : ''}</li>`).join('')}</ul>`;
      case 'awards':
        return `<ul>${resume.awards.map((award) => `<li>${escapeHtml(award.title)}${award.awarder ? ` — ${escapeHtml(award.awarder)}` : ''}</li>`).join('')}</ul>`;
      case 'languages':
        return `<ul class="inline">${resume.languages.map((language) => `<li>${escapeHtml(language.language)} (${escapeHtml(language.fluency)})</li>`).join('')}</ul>`;
      default:
        return '';
    }
  })();
  return `<section class="section" data-section="${section}"><h2 class="section-title">${escapeHtml(title)}</h2>${body}</section>`;
}

export function renderResumeHtml(resume: ResumeJson, template: ResumeTemplate, settings: DocumentSettings, options: { preview?: boolean } = {}): string {
  const color = accent(template, settings);
  const order = effectiveSectionOrder(template, settings);
  const sidebarSections: SectionId[] = ['skills', 'languages', 'certifications', 'awards'];
  const railSections: SectionId[] = ['skills', 'education', 'certifications', 'languages', 'awards'];
  const isSidebar = template.layout === 'sidebar-left' || template.layout === 'sidebar-right';
  const isTwoColumn = template.layout === 'two-column';
  const density = settings.densityOverride ?? template.density;

  const header = `
    <header class="resume-header">
      <h1 class="name">${escapeHtml(resume.basics.name)}</h1>
      ${resume.basics.label ? `<p class="label">${escapeHtml(resume.basics.label)}</p>` : ''}
      <p class="contact">${escapeHtml(contactLine(resume))}</p>
      ${resume.basics.profiles.length > 0 ? `<p class="links">${resume.basics.profiles.map((profile) => `<a href="${escapeHtml(profile.url)}">${escapeHtml(profile.url.replace(/^https?:\/\//, ''))}</a>`).join('')}</p>` : ''}
    </header>`;

  const mainOrder = isSidebar ? order.filter((section) => !sidebarSections.includes(section)) : isTwoColumn ? order.filter((section) => !railSections.includes(section)) : order;
  const sideOrder = isSidebar ? order.filter((section) => sidebarSections.includes(section)) : isTwoColumn ? order.filter((section) => railSections.includes(section)) : [];

  const mainHtml = mainOrder.map((section) => sectionHtml(resume, section, template.layout === 'timeline')).join('');
  const sideHtml = sideOrder.map((section) => sectionHtml(resume, section, false)).join('');

  const content = isSidebar
    ? `<div class="layout-sidebar ${template.layout === 'sidebar-right' ? 'reverse' : ''}"><aside class="side">${header}${sideHtml}</aside><main class="main">${mainHtml}</main></div>`
    : isTwoColumn
      ? `<div class="layout-two-col">${header}<div class="layout-two-col-body"><main class="main">${mainHtml}</main><aside class="rail">${sideHtml}</aside></div></div>`
      : `${header}${mainHtml}`;

  const uniqueId = `jobpal-${template.id}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(resume.basics.name)} — Resume</title>
<meta name="generator" content="JobPal" />
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: resume.basics.name,
    jobTitle: resume.basics.label,
    email: resume.basics.email ? `mailto:${resume.basics.email}` : undefined,
    telephone: resume.basics.phone,
    address: resume.basics.location,
    sameAs: resume.basics.profiles.map((profile) => profile.url),
    worksFor: resume.work[0] ? { '@type': 'Organization', name: resume.work[0].name } : undefined,
    alumniOf: resume.education.map((item) => ({ '@type': 'EducationalOrganization', name: item.institution })),
    knowsAbout: resume.skills.flatMap((group) => group.keywords).slice(0, 40),
  })}</script>
<style>
  :root { --accent: ${color}; --text: #14161c; --muted: #5b6270; --line: #e2e4ea; }
  * { box-sizing: border-box; }
  body { margin: 0; background: ${options.preview ? 'transparent' : '#f3f4f8'}; color: var(--text); font-family: ${fontStack(template)}; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: ${density === 'compact' ? '14mm' : '18mm'}; font-size: ${density === 'compact' ? '10.2pt' : '10.8pt'}; line-height: 1.45; }
  .resume-header { margin-bottom: 6mm; }
  .name { font-size: ${density === 'compact' ? '20pt' : '24pt'}; margin: 0; letter-spacing: -0.01em; }
  .label { color: var(--accent); margin: 2px 0 4px; font-size: 11pt; }
  .contact, .links { color: var(--muted); margin: 1px 0; font-size: 9.4pt; }
  .links a { color: var(--accent); text-decoration: none; margin-right: 10px; }
  .section { margin-top: 5.5mm; }
  .section-title { font-size: 10.6pt; margin: 0 0 2.4mm; color: var(--accent); ${template.divider === 'line' ? 'border-bottom: 1px solid var(--line); padding-bottom: 1.6mm;' : ''} ${template.divider === 'bar' ? 'position: relative; padding-bottom: 3mm;' : ''} }
  ${template.divider === 'bar' ? '.section-title::after { content: ""; position: absolute; left: 0; bottom: 0; width: 12mm; height: 2.2px; background: var(--accent); }' : ''}
  ${template.divider === 'dot' ? '.section-title::before { content: "●"; color: var(--accent); font-size: 7pt; vertical-align: 2px; margin-right: 6px; }' : ''}
  .entry { margin-bottom: 4mm; }
  .entry-head { display: flex; justify-content: space-between; gap: 8mm; align-items: baseline; }
  .entry-title { font-size: 11pt; margin: 0; }
  .entry-sub { margin: 1px 0 0; color: var(--accent); font-size: 9.8pt; }
  .entry-date { color: var(--muted); font-size: 9.2pt; white-space: nowrap; }
  .entry-desc { margin: 2px 0; color: var(--muted); font-style: italic; font-size: 10pt; }
  ul { margin: 1.6mm 0 0; padding-left: 5mm; }
  li { margin-bottom: 1mm; }
  ul.inline { display: flex; flex-wrap: wrap; gap: 2mm 6mm; padding-left: 0; list-style: none; }
  .skill-group { display: flex; gap: 2mm; margin-bottom: 1.8mm; font-size: 10pt; }
  .skill-cat { font-weight: 600; min-width: 22mm; }
  .skill-items { display: flex; flex-wrap: wrap; gap: 1.4mm; }
  .chip { background: ${options.preview ? 'rgba(0,0,0,0.05)' : '#f1f2f6'}; border-radius: 3px; padding: 0.4mm 1.6mm; font-size: 9pt; }
  .summary { margin: 0; }
  .layout-sidebar { display: grid; grid-template-columns: 34% 1fr; min-height: 260mm; margin: -${density === 'compact' ? '14mm' : '18mm'}; }
  .layout-sidebar.reverse { grid-template-columns: 1fr 34%; }
  .layout-sidebar.reverse .side { order: 2; }
  .layout-sidebar .side { background: var(--accent); color: #fff; padding: ${density === 'compact' ? '12mm 7mm' : '16mm 8mm'}; }
  .layout-sidebar .side .name, .layout-sidebar .side .label, .layout-sidebar .side .contact, .layout-sidebar .side .links, .layout-sidebar .side .section-title, .layout-sidebar .side .contact a, .layout-sidebar .side .entry-sub { color: #fff; }
  .layout-sidebar .side .label { opacity: 0.9; }
  .layout-sidebar .side .contact, .layout-sidebar .side .links { opacity: 0.94; }
  .layout-sidebar .side .links a { display: block; margin-right: 0; color: #fff; }
  .layout-sidebar .side .section-title { border-bottom: 1px solid rgba(255,255,255,0.35); }
  .layout-sidebar .side .chip { background: rgba(255,255,255,0.16); color: #fff; }
  .layout-sidebar .side .skill-group { flex-direction: column; gap: 1mm; }
  .layout-sidebar .side .skill-cat { color: #fff; }
  .layout-sidebar .main { padding: ${density === 'compact' ? '12mm 9mm' : '16mm 10mm'}; }
  .layout-two-col-body { display: grid; grid-template-columns: 1fr 32%; gap: 8mm; }
  .rail .section-title { font-size: 10pt; }
  footer { margin-top: 6mm; color: #9aa0ac; font-size: 8pt; text-align: center; }
  ${headingCss(template)}
  ${options.preview ? '' : '@media print { body { background: #fff; } .page { margin: 0; width: auto; min-height: auto; padding: 12mm; } @page { size: ' + (settings.pageSize === 'a4' ? 'A4' : 'letter') + '; margin: 0; } }'}
</style>
</head>
<body>
<div class="page" id="${uniqueId}">
${content}
</div>
</body>
</html>`;
}

export function renderCoverLetterHtml(resume: ResumeJson, template: ResumeTemplate, settings: DocumentSettings, body: string, _target?: { title?: string; company?: string }): string {
  const color = accent(template, settings);
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.split('\n').map((line) => escapeHtml(line)).join('<br/>')}</p>`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(resume.basics.name)} — Cover Letter</title>
<style>
  :root { --accent: ${color}; --text: #14161c; --muted: #5b6270; }
  body { margin: 0; background: #f3f4f8; color: var(--text); font-family: ${fontStack(template)}; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 20mm; font-size: 11pt; line-height: 1.55; }
  .name { font-size: 22pt; margin: 0 0 2px; }
  .label { color: var(--accent); margin: 0 0 4px; }
  .contact { color: var(--muted); font-size: 9.6pt; margin: 1px 0; }
  .rule { height: 2px; background: var(--accent); width: 100%; margin: 5mm 0; }
  .meta { color: var(--muted); margin-bottom: 6mm; }
  .target { font-weight: 600; margin-bottom: 1mm; }
  p { margin: 0 0 4.5mm; }
  @media print { body { background: #fff; } @page { size: ${settings.pageSize === 'a4' ? 'A4' : 'letter'}; margin: 0; } }
</style>
</head>
<body>
<div class="page">
  <h1 class="name">${escapeHtml(resume.basics.name)}</h1>
  ${resume.basics.label ? `<p class="label">${escapeHtml(resume.basics.label)}</p>` : ''}
  <p class="contact">${escapeHtml(contactLine(resume))}</p>
  <div class="rule"></div>
  <div class="meta">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
  ${paragraphs}
</div>
</body>
</html>`;
}
