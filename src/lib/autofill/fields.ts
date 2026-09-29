import type { AutofillSettings, Profile } from '@/types';
import { normalizeWhitespace } from '@/lib/utils';

export type FieldKey =
  | 'firstName'
  | 'lastName'
  | 'middleName'
  | 'fullName'
  | 'preferredName'
  | 'email'
  | 'phone'
  | 'address1'
  | 'address2'
  | 'city'
  | 'state'
  | 'postalCode'
  | 'country'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'website'
  | 'twitter'
  | 'summary'
  | 'coverLetter'
  | 'currentCompany'
  | 'currentTitle'
  | 'yearsExperience'
  | 'desiredSalary'
  | 'noticePeriod'
  | 'availableFrom'
  | 'workAuthorization'
  | 'requiresSponsorship'
  | 'willingToRelocate'
  | 'dateOfBirth'
  | 'nationality'
  | 'school'
  | 'degree'
  | 'fieldOfStudy'
  | 'gradYear'
  | 'gpa'
  | 'gender'
  | 'race'
  | 'veteran'
  | 'disability'
  | 'resumeFile'
  | 'coverLetterFile'
  | 'unknown';

export interface FieldDefinition {
  key: FieldKey;
  label: string;
  autocomplete?: string[];
  patterns: RegExp[];
  negative?: RegExp[];
  sensitive?: boolean;
  file?: boolean;
}

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  { key: 'firstName', label: 'First name', autocomplete: ['given-name'], patterns: [/\bfirst\s*name\b/i, /\bgiven\s*name\b/i, /\bfname\b/i, /\bforename\b/i] },
  { key: 'lastName', label: 'Last name', autocomplete: ['family-name'], patterns: [/\blast\s*name\b/i, /\bfamily\s*name\b/i, /\bsurname\b/i, /\blname\b/i] },
  { key: 'middleName', label: 'Middle name', autocomplete: ['additional-name'], patterns: [/\bmiddle\s*(name|initial)\b/i] },
  { key: 'preferredName', label: 'Preferred name', autocomplete: ['nickname'], patterns: [/\bpreferred\s*(first\s*)?name\b/i, /\bnickname\b/i, /\bknown\s*as\b/i] },
  { key: 'fullName', label: 'Full name', autocomplete: ['name'], patterns: [/\b(full|your|legal|candidate)\s*name\b/i, /^name$/i, /\bname\b/i], negative: [/company|employer|school|university|referr|user|file|last|first|middle|preferred|mother|father|emergency/i] },
  { key: 'email', label: 'Email', autocomplete: ['email'], patterns: [/\be-?mail\b/i, /\bemail\s*address\b/i], negative: [/confirm|verify|re-?enter|repeat/i] },
  { key: 'phone', label: 'Phone', autocomplete: ['tel', 'tel-national'], patterns: [/\b(phone|mobile|cell|telephone|contact\s*number)\b/i], negative: [/country|extension|ext\b|code/i] },
  { key: 'address1', label: 'Address', autocomplete: ['street-address', 'address-line1'], patterns: [/\b(street|address\s*(line)?\s*1|address)\b/i], negative: [/e-?mail|url|website|ip\b|address2|line 2|city|zip|postal/i] },
  { key: 'address2', label: 'Address line 2', autocomplete: ['address-line2'], patterns: [/\b(address\s*(line)?\s*2|apt|apartment|suite|unit|floor)\b/i] },
  { key: 'city', label: 'City', autocomplete: ['address-level2'], patterns: [/\b(city|town|locality)\b/i], negative: [/citizenship/i] },
  { key: 'state', label: 'State / region', autocomplete: ['address-level1'], patterns: [/\b(state|province|region|county)\b/i], negative: [/united states|statement/i] },
  { key: 'postalCode', label: 'Postal code', autocomplete: ['postal-code'], patterns: [/\b(zip|postal|post\s*code)\b/i] },
  { key: 'country', label: 'Country', autocomplete: ['country', 'country-name'], patterns: [/\bcountry\b/i], negative: [/code|phone/i] },
  { key: 'linkedin', label: 'LinkedIn', patterns: [/\blinked\s*-?in\b/i], negative: [/password/i] },
  { key: 'github', label: 'GitHub', patterns: [/\bgit\s*-?hub\b/i] },
  { key: 'portfolio', label: 'Portfolio', patterns: [/\bportfolio\b/i, /\bbehance\b/i, /\bdribbble\b/i] },
  { key: 'website', label: 'Website', patterns: [/\b(website|personal\s*site|web\s*page|blog|url)\b/i], negative: [/linkedin|github|portfolio|company/i] },
  { key: 'twitter', label: 'X / Twitter', patterns: [/\b(twitter|x\.com)\b/i] },
  { key: 'currentCompany', label: 'Current company', autocomplete: ['organization'], patterns: [/\b(current|present|most recent)?\s*(company|employer|organisation|organization)\b/i], negative: [/previous|why|cover|letter/i] },
  { key: 'currentTitle', label: 'Current title', autocomplete: ['organization-title'], patterns: [/\b(job\s*title|position|role|current\s*title)\b/i], negative: [/company|apply/i] },
  { key: 'yearsExperience', label: 'Years of experience', patterns: [/\b(years?|yrs?)\s*(of)?\s*(professional\s*)?experience\b/i, /\bexperience\s*(in\s*)?years\b/i] },
  { key: 'desiredSalary', label: 'Desired salary', patterns: [/\b(salary|compensation|pay|rate)\s*(expectation|requirement|desired|expectation)?\b/i, /\bexpected\s*(salary|compensation|pay|ctc)\b/i, /\bctc\b/i] },
  { key: 'noticePeriod', label: 'Notice period', patterns: [/\bnotice\s*period\b/i, /\bhow\s*(much|long)\s*(notice|time)\b/i] },
  { key: 'availableFrom', label: 'Available from', patterns: [/\b(start\s*date|available\s*(from|date)|earliest\s*start|when\s*can\s*you\s*start)\b/i] },
  { key: 'workAuthorization', label: 'Work authorisation', patterns: [/\b(work\s*(authorisation|authorization|permit)|right\s*to\s*work|legally\s*(authorised|authorized|eligible|able)|visa\s*status)\b/i] },
  { key: 'requiresSponsorship', label: 'Requires sponsorship', patterns: [/\b(sponsor|sponsorship)\b/i] },
  { key: 'willingToRelocate', label: 'Willing to relocate', patterns: [/\brelocat/i] },
  { key: 'dateOfBirth', label: 'Date of birth', patterns: [/\b(date\s*of\s*birth|birth\s*date|dob|birthday)\b/i], sensitive: true },
  { key: 'nationality', label: 'Nationality', patterns: [/\bnationality\b/i], sensitive: true },
  { key: 'school', label: 'School', patterns: [/\b(school|university|college|institution)\b/i] },
  { key: 'degree', label: 'Degree', patterns: [/\b(degree|qualification|education\s*level)\b/i] },
  { key: 'fieldOfStudy', label: 'Field of study', patterns: [/\b(major|field\s*of\s*study|discipline|specialisation|specialization|subject)\b/i] },
  { key: 'gradYear', label: 'Graduation year', patterns: [/\b(graduation|grad|completion)\s*(year|date)\b/i] },
  { key: 'gpa', label: 'GPA', patterns: [/\b(gpa|grade\s*point)\b/i] },
  { key: 'gender', label: 'Gender', patterns: [/\bgender\b/i], sensitive: true },
  { key: 'race', label: 'Race / ethnicity', patterns: [/\b(race|ethnicity|ethnic)\b/i], sensitive: true },
  { key: 'veteran', label: 'Veteran status', patterns: [/\bveteran\b/i], sensitive: true },
  { key: 'disability', label: 'Disability status', patterns: [/\bdisabilit/i], sensitive: true },
  { key: 'coverLetter', label: 'Cover letter', patterns: [/\bcover\s*letter\b/i, /\bwhy\s*(do\s*you|are\s*you|would\s*you)\b/i, /\bmessage\s*to\s*(the\s*)?(hiring|recruiting)\b/i] },
  { key: 'resumeFile', label: 'Resume file', patterns: [/\b(resume|cv|curriculum\s*vitae)\b/i], file: true },
  { key: 'coverLetterFile', label: 'Cover letter file', patterns: [/\bcover\s*letter\b/i], file: true },
];

function scoreDefinition(definition: FieldDefinition, haystacks: { text: string; weight: number }[]): number {
  let score = 0;
  for (const { text, weight } of haystacks) {
    if (!text) continue;
    if (definition.negative?.some((pattern) => pattern.test(text))) {
      score -= 0.9 * weight;
      continue;
    }
    for (const pattern of definition.patterns) {
      if (pattern.test(text)) {
        score += weight;
        break;
      }
    }
  }
  return score;
}

export interface FieldCandidate {
  key: FieldKey;
  confidence: number;
}

export function classifyField(input: {
  label?: string;
  name?: string;
  id?: string;
  placeholder?: string;
  autocomplete?: string;
  type?: string;
  ariaLabel?: string;
}): FieldCandidate {
  const haystacks = [
    { text: (input.autocomplete ?? '').toLowerCase(), weight: 3.2 },
    { text: (input.name ?? '').replace(/[_-]+/g, ' '), weight: 1.6 },
    { text: (input.id ?? '').replace(/[_-]+/g, ' '), weight: 1.5 },
    { text: (input.label ?? ''), weight: 2.6 },
    { text: (input.ariaLabel ?? ''), weight: 2.2 },
    { text: (input.placeholder ?? ''), weight: 1.1 },
  ];

  const type = (input.type ?? '').toLowerCase();
  const autocompleteTokens = (input.autocomplete ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  let best: FieldCandidate = { key: 'unknown', confidence: 0 };
  for (const definition of FIELD_DEFINITIONS) {
    if (definition.file && type !== 'file') continue;
    if (!definition.file && type === 'file') continue;
    let score = scoreDefinition(definition, haystacks);
    if (definition.autocomplete?.some((token) => autocompleteTokens.includes(token))) score += 4;
    if (type === 'email' && definition.key === 'email') score += 2.4;
    if (type === 'tel' && definition.key === 'phone') score += 2.2;
    const confidence = Math.max(0, Math.min(1, score / 4));
    if (confidence > best.confidence) {
      best = { key: definition.key, confidence: Math.round(confidence * 100) / 100 };
    }
  }
  return best;
}

export interface FieldValues {
  [key: string]: string;
}

export function buildFieldValues(
  profile: Profile,
  settings: AutofillSettings,
  extras: { coverLetter?: string; resumeFileKey?: string } = {},
): FieldValues {
  const contact = profile.contact;
  const values: FieldValues = {
    firstName: contact.firstName,
    lastName: contact.lastName,
    middleName: contact.middleName ?? '',
    preferredName: contact.preferredName ?? '',
    fullName: [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' '),
    email: contact.email,
    phone: contact.phone,
    address1: contact.address ?? '',
    address2: contact.address2 ?? '',
    city: contact.city ?? '',
    state: contact.state ?? '',
    postalCode: contact.postalCode ?? '',
    country: contact.country ?? '',
    linkedin: profile.presence.linkedin ?? '',
    github: profile.presence.github ?? '',
    portfolio: profile.presence.portfolio ?? '',
    website: profile.presence.website ?? '',
    twitter: profile.presence.twitter ?? '',
    summary: profile.summary,
    currentCompany: profile.experience[0]?.company ?? '',
    currentTitle: profile.experience[0]?.title ?? '',
    yearsExperience: String(Math.max(1, Math.round(totalExperience(profile)))),
    desiredSalary: profile.eligibility.desiredSalary ?? '',
    noticePeriod: profile.eligibility.noticePeriod ?? '',
    availableFrom: profile.eligibility.availableFrom ?? '',
    workAuthorization: profile.eligibility.workAuthorization,
    requiresSponsorship: profile.eligibility.requiresSponsorship === null ? '' : profile.eligibility.requiresSponsorship ? 'Yes' : 'No',
    willingToRelocate: profile.eligibility.willingToRelocate === null ? '' : profile.eligibility.willingToRelocate ? 'Yes' : 'No',
    dateOfBirth: contact.dateOfBirth ?? '',
    nationality: contact.nationality ?? '',
    school: profile.education[0]?.school ?? '',
    degree: profile.education[0]?.degree ?? '',
    fieldOfStudy: profile.education[0]?.field ?? '',
    gradYear: profile.education[0]?.end ?? '',
    gpa: profile.education[0]?.gpa ?? '',
    coverLetter: extras.coverLetter ?? '',
  };

  if (profile.eeo.enabled && settings.fillSensitive) {
    values.gender = profile.eeo.gender ?? '';
    values.race = profile.eeo.race ?? '';
    values.veteran = profile.eeo.veteranStatus ?? '';
    values.disability = profile.eeo.disabilityStatus ?? '';
  }
  return values;
}

function totalExperience(profile: Profile): number {
  const now = Date.now();
  let months = 0;
  for (const item of profile.experience) {
    const start = item.start ? Date.parse(item.start.length === 4 ? `${item.start}-01-01` : item.start) : NaN;
    const end = item.current || !item.end ? now : Date.parse(item.end.length === 4 ? `${item.end}-01-01` : item.end);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) months += (end - start) / (1000 * 60 * 60 * 24 * 30.44);
  }
  return months / 12;
}

export function labelForField(key: FieldKey): string {
  return FIELD_DEFINITIONS.find((definition) => definition.key === key)?.label ?? normalizeWhitespace(key);
}
