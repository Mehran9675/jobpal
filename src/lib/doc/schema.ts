import type { DocumentSettings, JobRecord, Profile, ResumeTemplate, SectionId } from '@/types';
import { DEFAULT_SECTION_ORDER } from '@/lib/defaults';
import { normalizeWhitespace } from '@/lib/utils';

export interface ResumeLocation {
  address?: string;
  postalCode?: string;
  city?: string;
  region?: string;
  countryCode?: string;
}

export interface ResumeJson {
  $schema: string;
  basics: {
    name: string;
    label: string;
    email: string;
    phone: string;
    url: string;
    summary: string;
    location: ResumeLocation;
    profiles: { network: string; username: string; url: string }[];
  };
  work: {
    name: string;
    position: string;
    url?: string;
    startDate: string;
    endDate: string;
    summary: string;
    highlights: string[];
    location?: string;
    keywords: string[];
  }[];
  education: {
    institution: string;
    url?: string;
    area: string;
    studyType: string;
    startDate: string;
    endDate: string;
    score: string;
    courses: string[];
  }[];
  skills: { name: string; level: string; keywords: string[] }[];
  projects: { name: string; description: string; highlights: string[]; keywords: string[]; url?: string }[];
  certificates: { name: string; date: string; issuer: string; url?: string }[];
  awards: { title: string; date: string; awarder: string; summary: string }[];
  languages: { language: string; fluency: string }[];
  meta: {
    version: string;
    generator: string;
    template: string;
    generatedAt: string;
  };
}

function isoMonth(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function profileToResume(
  profile: Profile,
  options: { template: ResumeTemplate; settings: DocumentSettings; job?: Pick<JobRecord, 'title' | 'company' | 'url' | 'keywords'> },
): ResumeJson {
  const { template, settings, job } = options;
  const contact = profile.contact;
  const presence = profile.presence;

  const profiles: ResumeJson['basics']['profiles'] = [];
  if (presence.linkedin) profiles.push({ network: 'LinkedIn', username: presence.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, ''), url: presence.linkedin });
  if (presence.github) profiles.push({ network: 'GitHub', username: presence.github.replace(/^https?:\/\/(www\.)?github\.com\//, ''), url: presence.github });
  if (presence.portfolio) profiles.push({ network: 'Portfolio', username: presence.portfolio.replace(/^https?:\/\//, ''), url: presence.portfolio });
  if (presence.website) profiles.push({ network: 'Website', username: presence.website.replace(/^https?:\/\//, ''), url: presence.website });
  if (presence.twitter) profiles.push({ network: 'Twitter', username: presence.twitter.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//, ''), url: presence.twitter });
  for (const other of presence.other) profiles.push({ network: other.label, username: other.url.replace(/^https?:\/\//, ''), url: other.url });

  const work = profile.experience
    .filter((item) => item.company || item.title)
    .map((item) => ({
      name: normalizeWhitespace(item.company),
      position: normalizeWhitespace(item.title),
      url: item.url,
      startDate: isoMonth(item.start),
      endDate: item.current ? '' : isoMonth(item.end) || isoMonth(item.start),
      summary: normalizeWhitespace(item.description),
      highlights: item.highlights.map((highlight) => normalizeWhitespace(highlight)).filter(Boolean),
      location: item.location,
      keywords: item.skills,
    }));

  const education = profile.education.map((item) => ({
    institution: normalizeWhitespace(item.school),
    area: normalizeWhitespace(item.field),
    studyType: normalizeWhitespace(item.degree),
    startDate: isoMonth(item.start),
    endDate: isoMonth(item.end),
    score: item.gpa ?? '',
    courses: item.highlights,
  }));

  const skills: ResumeJson['skills'] = profile.skills
    .filter((group) => group.items.length > 0)
    .map((group) => ({ name: normalizeWhitespace(group.category || 'Skills'), level: '', keywords: group.items.map(normalizeWhitespace).filter(Boolean) }));

  const cityState = [contact.city, contact.state].filter(Boolean).join(', ');

  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' '),
      label: contact.headline ?? '',
      email: contact.email,
      phone: contact.phone,
      url: presence.website ?? presence.portfolio ?? '',
      summary: normalizeWhitespace(profile.summary),
      location: {
        address: contact.address,
        postalCode: contact.postalCode,
        city: cityState,
        countryCode: contact.country,
      },
      profiles,
    },
    work,
    education,
    skills,
    projects: profile.projects.map((project) => ({
      name: normalizeWhitespace(project.name),
      description: normalizeWhitespace(project.description),
      highlights: project.highlights,
      keywords: project.skills,
      url: project.url,
    })),
    certificates: profile.certifications.map((cert) => ({
      name: normalizeWhitespace(cert.name),
      date: isoMonth(cert.date),
      issuer: normalizeWhitespace(cert.issuer),
      url: cert.url,
    })),
    awards: profile.awards.map((award) => ({
      title: normalizeWhitespace(award.title),
      date: isoMonth(award.date),
      awarder: normalizeWhitespace(award.issuer ?? ''),
      summary: normalizeWhitespace(award.description ?? ''),
    })),
    languages: profile.languages.map((language) => ({ language: language.language, fluency: language.level })),
    meta: {
      version: 'v1.0.0',
      generator: 'JobPal',
      template: template.id,
      generatedAt: new Date().toISOString(),
    },
  };
}

export function effectiveSectionOrder(template: ResumeTemplate, settings: DocumentSettings): SectionId[] {
  const order = settings.sectionOrderOverride?.length ? settings.sectionOrderOverride : template.sectionOrder.length > 0 ? template.sectionOrder : DEFAULT_SECTION_ORDER;
  return order.filter((section) => !settings.hiddenSections.includes(section));
}

export function sectionHasContent(resume: ResumeJson, section: SectionId): boolean {
  switch (section) {
    case 'summary':
      return resume.basics.summary.length > 0;
    case 'experience':
      return resume.work.length > 0;
    case 'skills':
      return resume.skills.some((group) => group.keywords.length > 0);
    case 'projects':
      return resume.projects.length > 0;
    case 'education':
      return resume.education.length > 0;
    case 'certifications':
      return resume.certificates.length > 0;
    case 'awards':
      return resume.awards.length > 0;
    case 'languages':
      return resume.languages.length > 0;
    default:
      return false;
  }
}

export const SECTION_LABELS: Record<SectionId, string> = {
  summary: 'Summary',
  experience: 'Experience',
  skills: 'Skills',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
  awards: 'Awards',
  languages: 'Languages',
  volunteer: 'Volunteering',
  interests: 'Interests',
};

export function contactLine(resume: ResumeJson): string {
  const basics = resume.basics;
  const location = [basics.location.city, basics.location.countryCode].filter(Boolean).join(', ');
  return [basics.email, basics.phone, location].filter(Boolean).join('  ·  ');
}

export function dateRange(start: string, end: string): string {
  const format = (value: string) => {
    if (!value) return '';
    const match = value.match(/^(\d{4})-(\d{2})/);
    if (!match) return value;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };
  const from = format(start);
  const to = end ? format(end) : 'Present';
  if (!from && !to) return '';
  return `${from} – ${to}`;
}
