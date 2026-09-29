import type { ResumeTemplate, SectionId } from '@/types';
import { contactLine, dateRange, sectionHasContent, SECTION_LABELS, type ResumeJson } from './schema';
export function renderResumeMarkdown(resume: ResumeJson): string {
  const lines: string[] = [];
  lines.push(`# ${resume.basics.name}`);
  if (resume.basics.label) lines.push(`**${resume.basics.label}**`);
  lines.push('');
  lines.push(contactLine(resume));
  if (resume.basics.profiles.length > 0) lines.push(resume.basics.profiles.map((profile) => `[${profile.network}](${profile.url})`).join(' · '));
  lines.push('');
  if (resume.basics.summary) {
    lines.push('## Summary', '', resume.basics.summary, '');
  }
  if (resume.work.length > 0) {
    lines.push('## Experience', '');
    for (const item of resume.work) {
      lines.push(`### ${item.position} - ${item.name}`);
      lines.push(`${dateRange(item.startDate, item.endDate)}${item.location ? ` · ${item.location}` : ''}`);
      if (item.summary) lines.push('', item.summary);
      for (const highlight of item.highlights) lines.push(`- ${highlight}`);
      lines.push('');
    }
  }
  if (resume.skills.length > 0) {
    lines.push('## Skills', '');
    for (const group of resume.skills) lines.push(`- **${group.name}:** ${group.keywords.join(', ')}`);
    lines.push('');
  }
  if (resume.projects.length > 0) {
    lines.push('## Projects', '');
    for (const project of resume.projects) {
      lines.push(`### ${project.name}${project.url ? ` - ${project.url}` : ''}`);
      if (project.description) lines.push(project.description);
      for (const highlight of project.highlights) lines.push(`- ${highlight}`);
      lines.push('');
    }
  }
  if (resume.education.length > 0) {
    lines.push('## Education', '');
    for (const item of resume.education) {
      lines.push(`- **${[item.studyType, item.area].filter(Boolean).join(', ')}** - ${item.institution} (${dateRange(item.startDate, item.endDate)})`);
    }
    lines.push('');
  }
  if (resume.certificates.length > 0) {
    lines.push('## Certifications', '');
    for (const cert of resume.certificates) lines.push(`- ${cert.name}${cert.issuer ? ` - ${cert.issuer}` : ''}`);
    lines.push('');
  }
  if (resume.awards.length > 0) {
    lines.push('## Awards', '');
    for (const award of resume.awards) lines.push(`- ${award.title}${award.awarder ? ` - ${award.awarder}` : ''}`);
    lines.push('');
  }
  if (resume.languages.length > 0) {
    lines.push('## Languages', '');
    lines.push(resume.languages.map((language) => `${language.language} (${language.fluency})`).join(' · '));
    lines.push('');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function renderResumePlainText(resume: ResumeJson, template: ResumeTemplate): string {
  const width = 78;
  const rule = '='.repeat(width);
  const thin = '-'.repeat(width);
  const lines: string[] = [];
  const center = (text: string) => {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return `${' '.repeat(padding)}${text}`;
  };
  const section = (id: SectionId) => {
    if (!sectionHasContent(resume, id)) return;
    lines.push('', thin, SECTION_LABELS[id].toUpperCase(), thin);
    switch (id) {
      case 'summary':
        lines.push(resume.basics.summary);
        break;
      case 'experience':
        for (const item of resume.work) {
          const dates = dateRange(item.startDate, item.endDate);
          lines.push(`${item.position} - ${item.name}${dates ? `  (${dates})` : ''}`);
          if (item.summary) lines.push(`  ${item.summary}`);
          for (const highlight of item.highlights) lines.push(`  • ${highlight}`);
          lines.push('');
        }
        break;
      case 'skills':
        for (const group of resume.skills) lines.push(`${group.name}: ${group.keywords.join(', ')}`);
        break;
      case 'projects':
        for (const project of resume.projects) {
          lines.push(`${project.name}${project.url ? ` - ${project.url}` : ''}`);
          if (project.description) lines.push(`  ${project.description}`);
          for (const highlight of project.highlights) lines.push(`  • ${highlight}`);
        }
        break;
      case 'education':
        for (const item of resume.education) lines.push(`${[item.studyType, item.area].filter(Boolean).join(', ')} - ${item.institution} (${dateRange(item.startDate, item.endDate)})`);
        break;
      case 'certifications':
        for (const cert of resume.certificates) lines.push(`• ${cert.name}${cert.issuer ? ` - ${cert.issuer}` : ''}`);
        break;
      case 'awards':
        for (const award of resume.awards) lines.push(`• ${award.title}${award.awarder ? ` - ${award.awarder}` : ''}`);
        break;
      case 'languages':
        lines.push(resume.languages.map((language) => `${language.language} (${language.fluency})`).join(' · '));
        break;
      default:
        break;
    }
  };

  lines.push(center(resume.basics.name));
  if (resume.basics.label) lines.push(center(resume.basics.label));
  lines.push(center(contactLine(resume)));
  if (resume.basics.profiles.length > 0) lines.push(center(resume.basics.profiles.map((profile) => profile.url.replace(/^https?:\/\//, '')).join('  ')));
  lines.push('', rule);
  const order = template.sectionOrder.length > 0 ? template.sectionOrder : (['summary', 'experience', 'skills', 'projects', 'education', 'certifications', 'awards', 'languages'] as SectionId[]);
  for (const id of order) section(id);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function renderMarkdownDoc(title: string, subtitle: string | undefined, sections: { heading: string; lines: string[] }[], bullets = true): string {
  const lines: string[] = [`# ${title}`];
  if (subtitle) lines.push('', `_${subtitle}_`);
  for (const section of sections) {
    lines.push('', `## ${section.heading}`, '');
    for (const line of section.lines) lines.push(bullets ? `- ${line}` : line);
  }
  return lines.join('\n').trim();
}
