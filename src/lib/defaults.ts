import type { AppSettings, DocumentSettings, PromptConfig, RuleDef, SectionId } from '@/types';

export const DEFAULT_TEMPLATE_ID = 'essential';

export const DEFAULT_SECTION_ORDER: SectionId[] = [
  'summary',
  'experience',
  'skills',
  'projects',
  'education',
  'certifications',
  'awards',
  'languages',
];

export const ALL_SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'summary', label: 'Professional summary' },
  { id: 'experience', label: 'Work experience' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'education', label: 'Education' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'awards', label: 'Awards' },
  { id: 'languages', label: 'Languages' },
  { id: 'volunteer', label: 'Volunteering' },
  { id: 'interests', label: 'Interests' },
];

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  templateId: DEFAULT_TEMPLATE_ID,
  pageSize: 'a4',
  hiddenSections: [],
  outputFormat: 'pdf',
  headlineMode: 'tailored',
  faithfulness: 60,
  allowGenerateWithoutDescription: false,
  fileSource: 'generated',
  includePhoto: false,
  fileNamePattern: '{{name}}-{{kind}}',
};

/** Old default that leaked the company and role into file names. */
export const LEGACY_FILENAME_PATTERN = '{{name}}_{{kind}}_{{company}}_{{role}}';

export const GLOBAL_PROMPT_PLACEHOLDER = `Add any standing instructions for the AI. Examples:
- Never invent metrics or employers.
- Keep the tone confident but humble.
- Always quantify impact with numbers when the source data supports it.
- Prefer British English.`;

export const DEFAULT_PROMPTS: PromptConfig = {
  globalInstructions: '',
  tone: 'professional',
  writingStyle: 'Impact-first, concise, ATS friendly. Lead bullets with strong verbs and measurable results.',
  avoidWords: ['synergy', 'ninja', 'rockstar', 'passionate about passionate'],
  emphasize: [],
  templates: {},
};

export interface CuratedRule extends RuleDef {}

export const CURATED_RULES: CuratedRule[] = [
  {
    id: 'match-experience-only',
    label: 'Apply only to jobs that match my experience',
    description: 'Skip any posting whose match score is below your threshold. Uses skills, seniority and domain overlap.',
    group: 'filters',
    defaultEnabled: true,
    configurable: 'number',
    defaultValue: 70,
  },
  {
    id: 'allow-missing-skills',
    label: 'Apply to jobs that list some experience I don’t have',
    description: 'Stretch roles are allowed as long as the core requirements are met. The agent will emphasise transferable skills.',
    group: 'filters',
    defaultEnabled: true,
  },
  {
    id: 'remote-only',
    label: 'Remote roles only',
    description: 'Only apply when the posting is remote or hybrid-friendly.',
    group: 'filters',
    defaultEnabled: false,
  },
  {
    id: 'require-salary',
    label: 'Require a listed salary',
    description: 'Skip postings without compensation information.',
    group: 'filters',
    defaultEnabled: false,
  },
  {
    id: 'salary-floor',
    label: 'Minimum salary',
    description: 'Skip postings whose listed range is below this annual amount.',
    group: 'filters',
    defaultEnabled: false,
    configurable: 'number',
    defaultValue: 60000,
  },
  {
    id: 'max-posting-age',
    label: 'Skip stale postings',
    description: 'Ignore postings older than this many days.',
    group: 'filters',
    defaultEnabled: false,
    configurable: 'number',
    defaultValue: 30,
  },
  {
    id: 'skip-staffing-agencies',
    label: 'Avoid staffing agencies',
    description: 'Skip postings that appear to be from recruiting agencies or talent marketplaces.',
    group: 'filters',
    defaultEnabled: true,
  },
  {
    id: 'seniority-match',
    label: 'Match my seniority level',
    description: 'Skip roles that are far above or below your current level.',
    group: 'filters',
    defaultEnabled: true,
  },
  {
    id: 'dedupe-applications',
    label: 'Never apply to the same company twice',
    description: 'Skip if you already applied to this company in the last 90 days.',
    group: 'filters',
    defaultEnabled: false,
  },
  {
    id: 'always-cover-letter',
    label: 'Write a cover letter when the form has a field for one',
    description: 'A cover letter is only generated when the application form actually asks for one (or when you request it explicitly). Optional fields count.',
    group: 'behaviour',
    defaultEnabled: true,
  },
  {
    id: 'answer-screening',
    label: 'Answer screening questions automatically',
    description: 'Draft answers for free-text questions using your profile, then fill them in.',
    group: 'behaviour',
    defaultEnabled: true,
  },
  {
    id: 'eeo-autofill',
    label: 'Fill voluntary EEO questions',
    description: 'Only used if you explicitly enabled EEO answers in your profile. Never sent to the AI.',
    group: 'privacy',
    defaultEnabled: false,
  },
  {
    id: 'review-before-submit',
    label: 'Always ask me before submitting',
    description: 'Strongest safety net: the agent fills everything and pings you to press submit.',
    group: 'privacy',
    defaultEnabled: true,
  },
  {
    id: 'human-like-pacing',
    label: 'Human-like pacing',
    description: 'Random delays between actions so activity never looks robotic.',
    group: 'privacy',
    defaultEnabled: true,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  ai: {
    activeProviderId: null,
    connections: {},
    temperature: 0.4,
    maxTokens: 4096,
    timeoutMs: 90000,
    tokenBudget: 0,
  },
  prompts: DEFAULT_PROMPTS,
  document: DEFAULT_DOCUMENT_SETTINGS,
  automation: {
    enabled: false,
    mode: 'assist',
    autoSubmit: false,
    dailyLimit: 15,
    minDelaySeconds: 4,
    maxDelaySeconds: 12,
    matchThreshold: 70,
    minConfidenceToSubmit: 0.82,
    rules: Object.fromEntries(
      CURATED_RULES.map((rule) => [rule.id, { enabled: rule.defaultEnabled, value: rule.defaultValue }]),
    ),
    neverSubmitDomains: [],
    allowlistEnabled: false,
    allowlist: [],
    huntEnabled: false,
    huntKeywords: '',
    huntLocations: '',
    maxPagesPerRun: 3,
    workingHours: { enabled: false, start: 9, end: 18, days: [1, 2, 3, 4, 5] },
    notifyOnIssue: true,
  },
  autofill: {
    enabled: true,
    fillSensitive: false,
    overwriteExisting: false,
    highlightFilled: true,
    answersBank: [],
  },
  ui: {
    theme: 'dark',
    accent: '#6366f1',
    compactDensity: false,
    autoOpenSidePanel: false,
    showOverlay: true,
  },
};

/**
 * Deep-merges a patch onto a base value.
 * `null` is an explicit tombstone: it clears the key (stored settings drop it,
 * so the default applies again). `undefined` means "leave unchanged".
 */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base;
  if (patch === null) return undefined as T;
  if (Array.isArray(base) || typeof base !== 'object') return patch as T;
  if (typeof patch !== 'object') return patch as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const current = (base as Record<string, unknown>)[key];
    const merged = deepMerge(current as never, value);
    if (merged === undefined) delete out[key];
    else out[key] = merged;
  }
  return out as T;
}
