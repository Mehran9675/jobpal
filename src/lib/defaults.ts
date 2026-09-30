import type { AppSettings, DocumentSettings, PromptConfig, SectionId } from '@/types';
import { TERMS_VERSION } from './legal';

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
  terms: { version: TERMS_VERSION },
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
