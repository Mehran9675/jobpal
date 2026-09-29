import type { EducationItem, ExtractedJob, JobSite, Profile, WorkExperience } from '@/types';
import { jobDescriptionText, looksLikeJobDescription, mainContentElement, metaContent, stripHtml } from './readability';
import { normalizeWhitespace, uid } from '@/lib/utils';

export function pickText(root: ParentNode, selectors: string[]): string {
  for (const selector of selectors) {
    const element = root.querySelector<HTMLElement>(selector);
    const text = normalizeWhitespace(element?.textContent ?? '');
    if (text) return text;
  }
  return '';
}

export function absoluteUrl(href: string | null | undefined, base: string): string {
  if (!href) return base;
  try {
    return new URL(href, base).toString();
  } catch {
    return base;
  }
}

export function canonicalize(url: string): string {
  try {
    const parsed = new URL(url);
    const trackers = [...parsed.searchParams.keys()].filter((key) => /^(utm_|ref|trk|trackingId|originalSubdomain|position|pageNum|currentJobId|eBP)/i.test(key));
    trackers.forEach((key) => parsed.searchParams.delete(key));
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------ */
/* Site adapters                                                       */
/* ------------------------------------------------------------------ */

export interface ApplicationFormHints {
  containerSelectors: string[];
  submitSelectors: string[];
  nextSelectors: string[];
  resumeUploadSelectors: string[];
}

export interface SiteAdapter {
  id: JobSite;
  label: string;
  hosts: RegExp[];
  jobTitleSelectors: string[];
  companySelectors: string[];
  locationSelectors: string[];
  salarySelectors?: string[];
  descriptionSelectors: string[];
  applicationForm?: ApplicationFormHints;
}

const DEFAULT_FORM_HINTS: ApplicationFormHints = {
  containerSelectors: ['form', '[class*="application"]', '[id*="application"]', 'main'],
  submitSelectors: ['button[type="submit"]', 'input[type="submit"]', 'button[id*="submit" i]', 'button[class*="submit" i]', 'button[data-automation-id*="submit" i]'],
  nextSelectors: ['button[data-automation-id="bottom-navigation-next-button"]', 'button[aria-label*="next" i]', 'button[class*="next" i]', 'button[id*="next" i]'],
  resumeUploadSelectors: ['input[type="file"][name*="resume" i]', 'input[type="file"][id*="resume" i]', 'input[type="file"]'],
};

export const SITE_ADAPTERS: SiteAdapter[] = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    hosts: [/linkedin\.com$/i],
    jobTitleSelectors: ['.job-details-jobs-unified-top-card__job-title h1', '.top-card-layout__title', 'h1.t-24.t-bold', 'h1'],
    companySelectors: ['.job-details-jobs-unified-top-card__company-name a', '.topcard__org-name-link', '.job-details-jobs-unified-top-card__primary-description-container a'],
    locationSelectors: ['.job-details-jobs-unified-top-card__primary-description-container .tvm__text', '.topcard__flavor--bullet', '.job-details-jobs-unified-top-card__bullet'],
    salarySelectors: ['.job-details-jobs-unified-top-card__job-insight span', '.compensation__salary'],
    descriptionSelectors: ['#job-details', '.jobs-description-content__text', '.show-more-less-html__markup', '.decorated-job-posting__details'],
    applicationForm: {
      containerSelectors: ['.jobs-easy-apply-content', '.jobs-easy-apply-modal', '[data-test-modal-id="easy-apply-modal"]'],
      submitSelectors: ['button[aria-label*="Submit application" i]', 'button[data-live-test-job-apply-button]'],
      nextSelectors: ['button[aria-label*="Continue to next step" i]', 'button[aria-label*="Review your application" i]', 'footer button.artdeco-button--primary'],
      resumeUploadSelectors: ['input[type="file"][name*="resume" i]', '.jobs-document-upload__container input[type="file"]', 'input[type="file"]'],
    },
  },
  {
    id: 'indeed',
    label: 'Indeed',
    hosts: [/indeed\.com$/i],
    jobTitleSelectors: ['.jobsearch-JobInfoHeader-title', 'h1[data-testid="jobsearch-JobInfoHeader-title"]', 'h1'],
    companySelectors: ['[data-testid="inlineHeader-companyName"]', '.jobsearch-CompanyInfoContainer a'],
    locationSelectors: ['[data-testid="inlineHeader-companyLocation"]', '.jobsearch-JobInfoHeader-companyLocation'],
    salarySelectors: ['#salaryInfoAndJobType', '.jobsearch-JobMetadataHeader-item'],
    descriptionSelectors: ['#jobDescriptionText', '.jobsearch-JobComponent-description'],
    applicationForm: {
      ...DEFAULT_FORM_HINTS,
      containerSelectors: ['.ia-Form', '.indeed-apply-widget', 'form'],
      submitSelectors: ['button[data-testid="submit-application-button"]', 'button[type="submit"]', 'button[id*="submit" i]'],
    },
  },
  {
    id: 'greenhouse',
    label: 'Greenhouse',
    hosts: [/greenhouse\.io$/i, /boards\.greenhouse\.io$/i],
    jobTitleSelectors: ['.app-title', 'h1.app-title', '#header h1', 'h1'],
    companySelectors: ['.company-name', '#header .company-name', '.main-header-text'],
    locationSelectors: ['.location', '#header .location', '.job__location'],
    descriptionSelectors: ['#content', '#job_description', 'div.job__description'],
    applicationForm: {
      containerSelectors: ['#application_form', 'form#application_form', 'form'],
      submitSelectors: ['#submit_app', 'input[type="submit"]', 'button[type="submit"]'],
      nextSelectors: [],
      resumeUploadSelectors: ['input[type="file"][name="resume"]', 'input#resume', 'input[type="file"]'],
    },
  },
  {
    id: 'lever',
    label: 'Lever',
    hosts: [/lever\.co$/i, /jobs\.lever\.co$/i],
    jobTitleSelectors: ['.posting-headline h2', '.posting-headline', 'h2'],
    companySelectors: ['.main-header-logo img[alt]', '.posting-headline .company'],
    locationSelectors: ['.posting-categories .location', '.posting-category.location'],
    descriptionSelectors: ['.section-wrapper .content', '.posting-page .content', '.content'],
    applicationForm: {
      containerSelectors: ['.application-form', 'form.application-form', 'form[action*="apply"]', 'form'],
      submitSelectors: ['button[type="submit"]', 'input[type="submit"]'],
      nextSelectors: [],
      resumeUploadSelectors: ['input[type="file"][name="resume"]', 'input[name="resume"]', 'input[type="file"]'],
    },
  },
  {
    id: 'workday',
    label: 'Workday',
    hosts: [/myworkdayjobs\.com$/i, /workday\.com$/i, /wd\d+\.myworkdayjobs\.com$/i],
    jobTitleSelectors: ['[data-automation-id="jobPostingHeader"]', 'h1[data-automation-id="jobPostingHeader"]', 'h1'],
    companySelectors: ['[data-automation-id="companyName"]', '[data-automation-id="jobPostingCompany"]'],
    locationSelectors: ['[data-automation-id="locations"]', '[data-automation-id="jobPostingLocation"]'],
    descriptionSelectors: ['[data-automation-id="jobPostingDescription"]'],
    applicationForm: {
      containerSelectors: ['[data-automation-id="applyFlowPage"]', '[data-automation-id="jobApplication"]', 'form'],
      submitSelectors: ['button[data-automation-id="bottom-navigation-next-button"]', 'button[data-automation-id="submit"]', 'button[type="submit"]'],
      nextSelectors: ['button[data-automation-id="bottom-navigation-next-button"]', 'button[data-automation-id="pageFooterNextButton"]'],
      resumeUploadSelectors: ['input[data-automation-id="file-upload-input-ref"]', 'input[type="file"]'],
    },
  },
  {
    id: 'ashby',
    label: 'Ashby',
    hosts: [/ashbyhq\.com$/i, /jobs\.ashbyhq\.com$/i],
    jobTitleSelectors: ['h1', '[class*="jobPostingHeader"] h1'],
    companySelectors: ['[class*="_companyName_"]', 'h2'],
    locationSelectors: ['[class*="location"]'],
    descriptionSelectors: ['[class*="_descriptionText_"]', '[class*="jobPostingDescription"]', 'main'],
    applicationForm: {
      containerSelectors: ['form[class*="application"]', 'form'],
      submitSelectors: ['button[type="submit"]'],
      nextSelectors: ['button[type="button"]:not([aria-label*="close" i])'],
      resumeUploadSelectors: ['input[type="file"][name*="resume" i]', 'input[type="file"]'],
    },
  },
  {
    id: 'smartrecruiters',
    label: 'SmartRecruiters',
    hosts: [/smartrecruiters\.com$/i, /jobs\.smartrecruiters\.com$/i],
    jobTitleSelectors: ['.job-title', 'h1.job-title', 'h1'],
    companySelectors: ['.company-name', '[itemprop="hiringOrganization"]'],
    locationSelectors: ['.job-location', '[itemprop="jobLocation"]'],
    descriptionSelectors: ['.job-sections', '.job-description', 'main'],
    applicationForm: {
      containerSelectors: ['form', '[data-test="application-form"]'],
      submitSelectors: ['button[type="submit"]'],
      nextSelectors: [],
      resumeUploadSelectors: ['input[type="file"]'],
    },
  },
  {
    id: 'bamboohr',
    label: 'BambooHR',
    hosts: [/bamboohr\.com$/i],
    jobTitleSelectors: ['.job-title', 'h1'],
    companySelectors: ['.company-name', '#header .company'],
    locationSelectors: ['.job-location'],
    descriptionSelectors: ['#jobDescription', '.job-description'],
    applicationForm: {
      ...DEFAULT_FORM_HINTS,
      containerSelectors: ['#applicationForm', 'form'],
    },
  },
  {
    id: 'icims',
    label: 'iCIMS',
    hosts: [/icims\.com$/i],
    jobTitleSelectors: ['.iCIMS_JobHeader h1', '.title h1', 'h1'],
    companySelectors: ['.iCIMS_JobHeader .company', '.iCIMS_CompanyName'],
    locationSelectors: ['.iCIMS_JobHeader .location', '.iCIMS_JobLocation'],
    descriptionSelectors: ['.iCIMS_JobContent', '#jobDescription'],
    applicationForm: { ...DEFAULT_FORM_HINTS, containerSelectors: ['#icims_content', 'form'] },
  },
  {
    id: 'taleo',
    label: 'Taleo',
    hosts: [/taleo\.net$/i],
    jobTitleSelectors: ['.titlepage h1', '.requisitionDescriptionInterface .title', 'h1'],
    companySelectors: ['.companyName', '#requisitionDescriptionInterface .company'],
    locationSelectors: ['.location', '#requisitionDescriptionInterface .location'],
    descriptionSelectors: ['#requisitionDescriptionInterface', '.contentlinepanel'],
    applicationForm: { ...DEFAULT_FORM_HINTS, containerSelectors: ['form#form', 'form'] },
  },
  {
    id: 'workable',
    label: 'Workable',
    hosts: [/workable\.com$/i, /apply\.workable\.com$/i],
    jobTitleSelectors: ['h1[data-ui="job-title"]', 'h1.job-title', 'h1'],
    companySelectors: ['[data-ui="company-name"]', '.company-name'],
    locationSelectors: ['[data-ui="job-location"]', '.job-location'],
    descriptionSelectors: ['[data-ui="job-description"]', '.job-description'],
    applicationForm: { ...DEFAULT_FORM_HINTS, containerSelectors: ['form[data-ui="application-form"]', 'form'] },
  },
  {
    id: 'recruitee',
    label: 'Recruitee',
    hosts: [/recruitee\.com$/i],
    jobTitleSelectors: ['.vacancy-title', 'h1'],
    companySelectors: ['.company-name'],
    locationSelectors: ['.vacancy-location'],
    descriptionSelectors: ['.vacancy-description', 'main'],
    applicationForm: { ...DEFAULT_FORM_HINTS, containerSelectors: ['form[action*="apply"]', 'form'] },
  },
  {
    id: 'jobvite',
    label: 'Jobvite',
    hosts: [/jobvite\.com$/i],
    jobTitleSelectors: ['.jv-header h1', 'h1'],
    companySelectors: ['.jv-header .company'],
    locationSelectors: ['.jv-job-detail-meta .location', '.jv-header .location'],
    descriptionSelectors: ['.jv-job-detail-description', '.jv-description'],
    applicationForm: { ...DEFAULT_FORM_HINTS, containerSelectors: ['#jv-apply-form', 'form'] },
  },
  {
    id: 'glassdoor',
    label: 'Glassdoor',
    hosts: [/glassdoor\.(com|co\.uk|de|fr|ca)$/i],
    jobTitleSelectors: ['[data-test="job-title"]', '.job-title', 'h1'],
    companySelectors: ['[data-test="employer-name"]', '.employer-name'],
    locationSelectors: ['[data-test="location"]', '.location'],
    descriptionSelectors: ['.jobDescriptionContent', '#JobDescriptionContainer', 'main'],
    applicationForm: DEFAULT_FORM_HINTS,
  },
  {
    id: 'ziprecruiter',
    label: 'ZipRecruiter',
    hosts: [/ziprecruiter\.com$/i],
    jobTitleSelectors: ['.job_title', 'h1.job_title', 'h1'],
    companySelectors: ['.hiring_company_text', '.company_name'],
    locationSelectors: ['.location', '.job_location'],
    descriptionSelectors: ['.job_description', '#job_description'],
    applicationForm: DEFAULT_FORM_HINTS,
  },
  {
    id: 'wellfound',
    label: 'Wellfound (AngelList)',
    hosts: [/wellfound\.com$/i, /angel\.co$/i],
    jobTitleSelectors: ['h1', '.job-title'],
    companySelectors: ['.company-name', '[class*="companyName"]'],
    locationSelectors: ['.location', '[class*="location"]'],
    descriptionSelectors: ['[class*="jobDescription"]', 'main'],
    applicationForm: DEFAULT_FORM_HINTS,
  },
];

export const GENERIC_ADAPTER: SiteAdapter = {
  id: 'generic',
  label: 'Generic page',
  hosts: [/.*/],
  jobTitleSelectors: ['h1[class*="job" i]', 'h1[class*="title" i]', '[class*="job-title" i] h1', 'h1'],
  companySelectors: ['[class*="company" i]', '[class*="employer" i]', '[itemprop="hiringOrganization"]'],
  locationSelectors: ['[class*="location" i]', '[itemprop="jobLocation"]'],
  descriptionSelectors: ['[class*="job-description" i]', '[class*="jobDescription" i]', '[id*="job-description" i]', 'article', 'main'],
  applicationForm: DEFAULT_FORM_HINTS,
};

export function adapterForUrl(url: string): SiteAdapter {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return GENERIC_ADAPTER;
  }
  return SITE_ADAPTERS.find((adapter) => adapter.hosts.some((host) => host.test(new URL(url).hostname)) || adapter.hosts.some((regex) => regex.test(host))) ?? GENERIC_ADAPTER;
}

/* ------------------------------------------------------------------ */
/* Generic extraction                                                  */
/* ------------------------------------------------------------------ */

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function extractJobFromDocument(doc: Document, url: string): ExtractedJob | null {
  const adapter = adapterForUrl(url);
  const ld = findJobPosting(doc);
  const title = ld?.title || pickText(doc, adapter.jobTitleSelectors) || metaContent(doc, ['og:title', 'twitter:title', 'title']);
  if (!title) return null;

  const company =
    ld?.company ||
    pickText(doc, adapter.companySelectors) ||
    metaContent(doc, ['og:site_name']) ||
    hostnameOf(url);

  const location = ld?.location || pickText(doc, adapter.locationSelectors);
  const salary = ld?.salary || pickText(doc, adapter.salarySelectors ?? []);
  // Page text only counts as a description when it reads like prose; form
  // labels and select options must never be picked up as the posting.
  const pageDescription = jobDescriptionText(doc);
  const description = ld?.description && ld.description.length > 120 ? ld.description : looksLikeJobDescription(pageDescription) ? pageDescription : '';
  if (!description || description.length < 120) return null;

  const remote = /remote|anywhere|distributed/i.test(`${location ?? ''} ${title} ${description.slice(0, 800)}`);
  return {
    url,
    canonicalUrl: canonicalize(url),
    site: adapter.id,
    title: normalizeWhitespace(title),
    company: normalizeWhitespace(company),
    location: location || undefined,
    remote,
    employmentType: ld?.employmentType ?? undefined,
    salary: salary || undefined,
    description,
    requirements: extractRequirementLines(description),
    keywords: [],
    postedAt: ld?.postedAt,
    easyApply: /easy apply|quick apply|1-click apply/i.test(doc.body?.innerText?.slice(0, 20000) ?? ''),
  };
}

interface JobPostingLd {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  description?: string;
  employmentType?: string;
  postedAt?: string;
}

export function findJobPosting(doc: Document): JobPostingLd | null {
  const scripts = doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const candidates: unknown[] = Array.isArray(parsed) ? parsed : [(parsed as { '@graph'?: unknown[] })?.['@graph'] ?? parsed].flat();
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      const record = candidate as Record<string, unknown>;
      const type = record['@type'];
      const types = Array.isArray(type) ? type : [type];
      if (!types.some((t) => typeof t === 'string' && t.toLowerCase().includes('jobposting'))) continue;

      const org = record.hiringOrganization as { name?: string } | undefined;
      const loc = record.jobLocation as { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string | { name?: string } } } | { address?: unknown } | undefined;
      const address = (loc as { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string | { name?: string } } })?.address;
      const country = typeof address?.addressCountry === 'string' ? address.addressCountry : address?.addressCountry?.name;
      const location = [address?.addressLocality, address?.addressRegion, country].filter(Boolean).join(', ');
      const salaryRecord = record.baseSalary as { value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string } | number; currency?: string } | undefined;
      let salary: string | undefined;
      if (salaryRecord?.value && typeof salaryRecord.value === 'object') {
        const { minValue, maxValue, value, unitText } = salaryRecord.value;
        const unit = unitText ? `/${unitText.toLowerCase()}` : '';
        const currency = salaryRecord.currency ? `${salaryRecord.currency} ` : '';
        if (minValue && maxValue) salary = `${currency}${minValue.toLocaleString()} - ${maxValue.toLocaleString()}${unit}`;
        else if (value) salary = `${currency}${value.toLocaleString()}${unit}`;
      }
      const remoteType = (record.jobLocationType as string | undefined) ?? undefined;

      return {
        title: typeof record.title === 'string' ? record.title : undefined,
        company: org?.name,
        location: location || (remoteType === 'TELECOMMUTE' ? 'Remote' : undefined),
        salary,
        description: typeof record.description === 'string' ? stripHtml(record.description) : undefined,
        employmentType: Array.isArray(record.employmentType) ? record.employmentType.filter((x) => typeof x === 'string').join(', ') : (record.employmentType as string | undefined),
        postedAt: typeof record.datePosted === 'string' ? record.datePosted : undefined,
      };
    }
  }
  return null;
}

function extractRequirementLines(description: string): string[] {
  const lines = description.split(/\r?\n/).map((line) => normalizeWhitespace(line.replace(/^[-•*·]\s*/, '')));
  const inRequirements = lines.filter((line) => line.length > 12 && line.length < 220 && /(experience|proficien|knowledge|degree|years?|skill|familiar|ability|require|must|bachelor|master|expert)/i.test(line));
  return [...new Set(inRequirements)].slice(0, 20);
}

/* ------------------------------------------------------------------ */
/* LinkedIn profile & job search scanning                              */
/* ------------------------------------------------------------------ */

export function extractLinkedInProfile(doc: Document): Partial<Profile> {
  const name = pickText(doc, ['h1.text-heading-xlarge', 'main h1', 'h1']);
  const headline = pickText(doc, ['.text-body-medium.break-words', '.pv-text-details__left-panel .text-body-medium', 'h2.text-body-medium']);
  const location = pickText(doc, ['.text-body-small.inline.t-black--light.break-words', '.pv-text-details__left-panel .text-body-small']);
  const about = pickText(doc, ['#about ~ div .display-flex.full-width', 'section#about .pv-shared-text-with-see-more', '[data-generated-suggestion-target]']);
  const [firstName = '', ...rest] = name.split(/\s+/);

  const experience = extractLinkedInTimeline(doc, 'experience').map<WorkExperience>((entry) => ({
    id: uid('exp'),
    company: entry.subtitle || entry.secondTitle || '',
    title: entry.title,
    location: entry.meta,
    start: entry.dates.split(/\s*[--]\s*/)[0] ?? '',
    end: entry.dates.split(/\s*[--]\s*/)[1],
    current: /present/i.test(entry.dates),
    description: entry.description,
    highlights: entry.description ? entry.description.split(/(?<=\.)\s+/).filter((s) => s.length > 30).slice(0, 5) : [],
    skills: [],
  }));

  const education = extractLinkedInTimeline(doc, 'education').map<EducationItem>((entry) => ({
    id: uid('edu'),
    school: entry.title,
    degree: entry.subtitle,
    field: entry.secondTitle,
    start: entry.dates.split(/\s*[--]\s*/)[0] ?? '',
    end: entry.dates.split(/\s*[--]\s*/)[1],
    highlights: [],
  }));

  const skills = extractLinkedInSkills(doc);

  return {
    contact: { firstName, lastName: rest.join(' '), email: '', phone: '', headline, city: location },
    summary: about,
    experience,
    education,
    skills: skills.length > 0 ? [{ category: 'Skills', items: skills }] : [],
  };
}

interface TimelineEntry {
  title: string;
  subtitle: string;
  secondTitle: string;
  meta: string;
  dates: string;
  description: string;
}

function extractLinkedInTimeline(doc: Document, sectionId: string): TimelineEntry[] {
  const section = doc.querySelector(`section#${sectionId}`) ?? doc.querySelector(`section[aria-label*="${sectionId}" i]`);
  if (!section) return [];
  const items = [...section.querySelectorAll<HTMLLIElement>('li.artdeco-list__item, li.pvs-list__paged-list-item, li')].filter((li) => normalizeWhitespace(li.textContent ?? '').length > 10);
  const entries: TimelineEntry[] = [];
  for (const item of items) {
    const lines = [...item.querySelectorAll('.t-bold span[aria-hidden="true"], .visually-hidden, .t-14 span[aria-hidden="true"], span[aria-hidden="true"]')]
      .map((node) => normalizeWhitespace(node.textContent ?? ''))
      .filter((text) => text.length > 1);
    const uniqueLines = [...new Set(lines)];
    if (uniqueLines.length === 0) continue;
    const dateLine = uniqueLines.find((line) => /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})/i.test(line) && line.length < 40) ?? '';
    const textLines = uniqueLines.filter((line) => line !== dateLine);
    entries.push({
      title: textLines[0] ?? uniqueLines[0],
      subtitle: textLines[1] ?? '',
      secondTitle: textLines[2] ?? '',
      meta: textLines.find((line) => /(remote|on-site|hybrid|,)/i.test(line) && line !== textLines[0] && line !== textLines[1]) ?? '',
      dates: dateLine,
      description: extractDescription(item, textLines),
    });
  }
  return dedupeTimeline(entries);
}

function extractDescription(item: HTMLLIElement, knownLines: string[]): string {
  const expanded = item.querySelector('.pvs-list__container .t-14, .display-flex.full-width .t-14, .pv-shared-text-with-see-more');
  const text = normalizeWhitespace(expanded?.textContent ?? '');
  if (text && !knownLines.includes(text)) return text;
  const spans = [...item.querySelectorAll('span[aria-hidden="true"]')]
    .map((node) => normalizeWhitespace(node.textContent ?? ''))
    .filter((line) => line.length > 60);
  return spans[0] ?? '';
}

function dedupeTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.title}|${entry.subtitle}|${entry.dates}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return entry.title.length > 0;
  });
}

export function extractLinkedInSkills(doc: Document): string[] {
  const section = doc.querySelector('section#skills') ?? doc.querySelector('section[aria-label*="skill" i]');
  if (!section) return [];
  const spans = [...section.querySelectorAll('span[aria-hidden="true"]')].map((node) => normalizeWhitespace(node.textContent ?? ''));
  return [...new Set(spans.filter((text) => text.length > 1 && text.length < 40 && !/endorsement|skill/i.test(text)))].slice(0, 60);
}

export function extractLinkedInJobCards(doc: Document): ExtractedJob[] {
  const cards = [...doc.querySelectorAll<HTMLElement>('li[data-occludable-job-id], .job-card-container, li.scaffold-layout__list-item, [data-job-id]')];
  const jobs: ExtractedJob[] = [];
  for (const card of cards) {
    const link = card.querySelector<HTMLAnchorElement>('a[href*="/jobs/view/"]') ?? card.querySelector<HTMLAnchorElement>('a[href*="/jobs/"]');
    if (!link) continue;
    const url = absoluteUrl(link.getAttribute('href'), location.href).split('?')[0];
    const title = pickText(card, ['.job-card-list__title', '.job-card-container__link', 'strong', 'h3']);
    const company = pickText(card, ['.job-card-container__company-name', '.artdeco-entity-lockup__subtitle', '.job-card-container__primary-description']);
    const cardLocation = pickText(card, ['.job-card-container__metadata-item', '.artdeco-entity-lockup__caption', '[class*="location"]']);
    if (!title) continue;
    jobs.push({
      url,
      canonicalUrl: canonicalize(url),
      site: 'linkedin',
      title,
      company,
      location: cardLocation,
      description: '',
      requirements: [],
      keywords: [],
    });
  }
  return jobs;
}

export function extractJobSearchCards(doc: Document, site: JobSite): ExtractedJob[] {
  if (site === 'linkedin') return extractLinkedInJobCards(doc);
  const selectors: Record<string, string> = {
    indeed: 'a.tapItem, div.job_seen_beacon a[id^="job_"]',
    glassdoor: 'li[data-test="jobListing"] a, a[data-test="job-link"]',
    ziprecruiter: 'article.job_result a, a[class*="job_link"]',
    workday: '',
    generic: 'a[href*="/job/"], a[href*="/jobs/"]',
  };
  const selector = selectors[site] ?? selectors.generic;
  if (!selector) return [];
  const seen = new Set<string>();
  const jobs: ExtractedJob[] = [];
  for (const anchor of [...doc.querySelectorAll<HTMLAnchorElement>(selector)].slice(0, 60)) {
    const url = absoluteUrl(anchor.getAttribute('href'), location.href).split('?')[0];
    if (!url || seen.has(url)) continue;
    const text = normalizeWhitespace(anchor.textContent ?? '');
    if (text.length < 5) continue;
    seen.add(url);
    jobs.push({
      url,
      canonicalUrl: canonicalize(url),
      site,
      title: text.slice(0, 120),
      company: '',
      description: '',
      requirements: [],
      keywords: [],
    });
  }
  return jobs;
}

export function detectPageSite(url: string, doc: Document): JobSite | 'linkedin-profile' | 'other' {
  if (/linkedin\.com\/in\//i.test(url)) return 'linkedin-profile';
  if (/linkedin\.com\/jobs\//i.test(url)) return 'linkedin';
  const adapter = adapterForUrl(url);
  if (adapter.id !== 'generic') return adapter.id;
  if (doc.querySelector('script[type="application/ld+json"]')) {
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
      if (/jobposting/i.test(script.textContent ?? '')) return 'generic';
    }
  }
  return 'other';
}

export function seemsLikeJobPosting(doc: Document, url: string): boolean {
  if (/\/jobs?\/view|job-details|greenhouse|lever\.co|workday|ashby|smartrecruiters|bamboohr/i.test(url)) return true;
  if (doc.querySelector('script[type="application/ld+json"]')?.textContent?.toLowerCase().includes('jobposting')) return true;
  const text = (doc.body?.innerText ?? '').slice(0, 6000).toLowerCase();
  return /apply (now|for this job)|job description|about the role|responsibilities|qualifications/.test(text) && /salary|compensation|full.time|part.time|remote|hybrid/.test(text);
}

export function pageMainText(doc: Document): string {
  const main = mainContentElement(doc);
  return normalizeWhitespace(main?.innerText ?? doc.body?.innerText ?? '').slice(0, 60000);
}
