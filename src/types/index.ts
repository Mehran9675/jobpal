export type ID = string;

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export interface ContactInfo {
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  headline?: string;
  email: string;
  phone: string;
  phoneCountry?: string;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  dateOfBirth?: string;
  nationality?: string;
}

export interface OnlinePresence {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  website?: string;
  twitter?: string;
  stackoverflow?: string;
  other: { label: string; url: string }[];
}

export interface WorkExperience {
  id: ID;
  company: string;
  title: string;
  location?: string;
  start: string;
  end?: string;
  current: boolean;
  description: string;
  highlights: string[];
  skills: string[];
  url?: string;
}

export interface EducationItem {
  id: ID;
  school: string;
  degree: string;
  field: string;
  location?: string;
  start?: string;
  end?: string;
  gpa?: string;
  highlights: string[];
}

export interface CertificationItem {
  id: ID;
  name: string;
  issuer: string;
  date?: string;
  expiry?: string;
  url?: string;
}

export interface LanguageSkill {
  language: string;
  level: 'native' | 'fluent' | 'professional' | 'intermediate' | 'basic';
}

export interface ProjectItem {
  id: ID;
  name: string;
  description: string;
  highlights: string[];
  url?: string;
  skills: string[];
}

export interface AwardItem {
  id: ID;
  title: string;
  issuer?: string;
  date?: string;
  description?: string;
}

export interface SkillGroup {
  category: string;
  items: string[];
}

export interface EeoAnswers {
  enabled: boolean;
  gender?: string;
  race?: string;
  veteranStatus?: string;
  disabilityStatus?: string;
}

export interface Eligibility {
  workAuthorization: string;
  requiresSponsorship: boolean | null;
  willingToRelocate: boolean | null;
  noticePeriod?: string;
  availableFrom?: string;
  desiredSalary?: string;
  desiredSalaryCurrency?: string;
}

export interface Profile {
  id: ID;
  variantName: string;
  isDefault: boolean;
  contact: ContactInfo;
  presence: OnlinePresence;
  summary: string;
  skills: SkillGroup[];
  experience: WorkExperience[];
  education: EducationItem[];
  certifications: CertificationItem[];
  languages: LanguageSkill[];
  projects: ProjectItem[];
  awards: AwardItem[];
  eligibility: Eligibility;
  eeo: EeoAnswers;
  updatedAt: number;
}

export function emptyProfile(id: ID, name = 'Primary'): Profile {
  return {
    id,
    variantName: name,
    isDefault: true,
    contact: { firstName: '', lastName: '', email: '', phone: '' },
    presence: { other: [] },
    summary: '',
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    languages: [],
    projects: [],
    awards: [],
    eligibility: { workAuthorization: '', requiresSponsorship: null, willingToRelocate: null },
    eeo: { enabled: false },
    updatedAt: Date.now(),
  };
}

export interface BaseResume {
  id: ID;
  name: string;
  source: 'upload' | 'paste' | 'linkedin' | 'manual';
  fileName?: string;
  format?: string;
  rawText: string;
  parsed?: Partial<Profile>;
  parsedAt?: number;
  createdAt: number;
}

/* ------------------------------------------------------------------ */
/* Jobs                                                                */
/* ------------------------------------------------------------------ */

export type JobSite =
  | 'linkedin'
  | 'indeed'
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'ashby'
  | 'smartrecruiters'
  | 'bamboohr'
  | 'icims'
  | 'taleo'
  | 'workable'
  | 'recruitee'
  | 'jobvite'
  | 'glassdoor'
  | 'ziprecruiter'
  | 'wellfound'
  | 'generic';

export interface ExtractedJob {
  url: string;
  canonicalUrl: string;
  site: JobSite;
  title: string;
  company: string;
  location?: string;
  remote?: boolean;
  employmentType?: string;
  salary?: string;
  description: string;
  requirements: string[];
  keywords: string[];
  postedAt?: string;
  easyApply?: boolean;
  applyUrl?: string;
}

export interface JobAnalysis {
  title: string;
  company: string;
  seniority: string;
  employmentType?: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  keywords: string[];
  tone: string;
  cultureSignals: string[];
  redFlags: string[];
  summary: string;
  highlightBullets: string[];
  matchedSkills: string[];
  missingSkills: string[];
  matchScore: number;
  recommendation: 'strong_match' | 'good_match' | 'stretch' | 'weak_match';
}

export interface ApplicationQuestion {
  id: ID;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'unknown';
  required: boolean;
  options?: string[];
  maxLength?: number;
  answer?: string;
}

export interface JobRecord {
  id: ID;
  url: string;
  canonicalUrl: string;
  site: JobSite;
  title: string;
  company: string;
  location?: string;
  remote?: boolean;
  employmentType?: string;
  salary?: string;
  description: string;
  requirements: string[];
  keywords: string[];
  postedAt?: string;
  scrapedAt: number;
  matchScore?: number;
  matchReasons: string[];
  missingSkills: string[];
  analysis?: JobAnalysis;
  questions: ApplicationQuestion[];
}

/* ------------------------------------------------------------------ */
/* Applications                                                        */
/* ------------------------------------------------------------------ */

export type ApplicationStatus =
  | 'draft'
  | 'ready'
  | 'queued'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'technical'
  | 'offer'
  | 'rejected'
  | 'withdrawn'
  | 'ghosted';

export const APPLICATION_STATUSES: { id: ApplicationStatus; label: string; tone: string }[] = [
  { id: 'draft', label: 'Draft', tone: 'neutral' },
  { id: 'ready', label: 'Ready to apply', tone: 'info' },
  { id: 'queued', label: 'Queued for agent', tone: 'info' },
  { id: 'applied', label: 'Applied', tone: 'primary' },
  { id: 'screening', label: 'Screening', tone: 'primary' },
  { id: 'interview', label: 'Interview', tone: 'success' },
  { id: 'technical', label: 'Technical round', tone: 'success' },
  { id: 'offer', label: 'Offer', tone: 'success' },
  { id: 'rejected', label: 'Rejected', tone: 'danger' },
  { id: 'withdrawn', label: 'Withdrawn', tone: 'neutral' },
  { id: 'ghosted', label: 'No response', tone: 'neutral' },
];

export interface TimelineEvent {
  at: number;
  label: string;
  status?: ApplicationStatus;
  note?: string;
}

export interface AnswerRecord {
  question: string;
  answer: string;
  required?: boolean;
}

export interface ApplicationRecord {
  id: ID;
  jobId: ID;
  jobTitle: string;
  company: string;
  jobUrl: string;
  site: JobSite;
  status: ApplicationStatus;
  createdAt: number;
  updatedAt: number;
  appliedAt?: number;
  documents: ID[];
  answers: AnswerRecord[];
  timeline: TimelineEvent[];
  notes: string;
  source: 'manual' | 'agent';
  autoSubmitted: boolean;
  matchScore?: number;
  needsAttention?: string;
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export type DocKind = 'resume' | 'cover_letter' | 'answers' | 'json_resume' | 'portfolio' | 'other';
export type DocFormat = 'pdf' | 'docx' | 'md' | 'txt' | 'html' | 'json';

export interface DocumentRecord {
  id: ID;
  applicationId?: ID;
  jobId?: ID;
  jobTitle?: string;
  company?: string;
  kind: DocKind;
  format: DocFormat;
  filename: string;
  mime: string;
  size: number;
  templateId?: string;
  createdAt: number;
  blob: Blob;
  textPreview?: string;
  /** Editable source content for generated files (kind-specific JSON). */
  content?: string;
  /** Set when the user edited the content and re-rendered the file. */
  editedAt?: number;
  /** True for files the user uploaded themselves (no job linkage, never regenerated). */
  uploaded?: boolean;
}

/* ------------------------------------------------------------------ */
/* AI                                                                  */
/* ------------------------------------------------------------------ */

export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'cohere';
export type AuthMode = 'api-key-bearer' | 'api-key-header' | 'api-key-query' | 'none' | 'oauth2';

export interface ProviderModel {
  id: string;
  label: string;
  contextWindow?: number;
  recommended?: boolean;
  tier?: 'flagship' | 'balanced' | 'fast' | 'reasoning' | 'local';
}

export interface OAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId?: string;
  extraAuthParams?: Record<string, string>;
  authStyle: 'pkce' | 'client-secret';
}

export interface ProviderDef {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  auth: AuthMode;
  authHeader?: string;
  authQueryParam?: string;
  keyUrl?: string;
  docsUrl?: string;
  local?: boolean;
  onDevice?: boolean;
  free?: boolean;
  description: string;
  models: ProviderModel[];
  defaultModel: string;
  supportsJsonMode?: boolean;
  apiVersion?: string;
  extraHeaders?: Record<string, string>;
  pathOverrides?: { chat?: string; models?: string };
  oauth?: OAuthConfig;
  custom?: boolean;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
}

export interface ProviderConnection {
  providerId: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  extraHeaders?: Record<string, string>;
  oauth?: OAuthTokens;
  models?: ProviderModel[];
  modelsFetchedAt?: number;
  verifiedAt?: number;
  status: 'untested' | 'ok' | 'error';
  lastError?: string;
  label?: string;
}

export interface AIConfig {
  activeProviderId: string | null;
  connections: Record<string, ProviderConnection>;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  /** Warn when cumulative token usage reaches this number (0 = never warn). */
  tokenBudget: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  signal?: AbortSignal;
  model?: string;
}

export interface ChatResult {
  text: string;
  model: string;
  providerId: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface AIStatus {
  ready: boolean;
  providerId?: string;
  providerName?: string;
  model?: string;
  reason?: string;
}

export interface UsageRecord {
  calls: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  lastAt?: number;
}

export interface UsageSummary {
  total: UsageRecord;
  byProvider: Record<string, UsageRecord>;
  byDay: Record<string, UsageRecord>;
  lastAt?: number;
  trackedSince?: number;
  /** True once the configured token budget has been announced. */
  warned?: boolean;
}

export interface ProviderUsageReport {
  supported: boolean;
  title: string;
  message: string;
  rows: { label: string; value: string }[];
}

/* ------------------------------------------------------------------ */
/* Documents / templates                                               */
/* ------------------------------------------------------------------ */

export type SectionId =
  | 'summary'
  | 'experience'
  | 'skills'
  | 'projects'
  | 'education'
  | 'certifications'
  | 'awards'
  | 'languages'
  | 'volunteer'
  | 'interests';

export type TemplateLayout =
  | 'classic'
  | 'sidebar-left'
  | 'sidebar-right'
  | 'two-column'
  | 'minimal'
  | 'compact'
  | 'timeline'
  | 'modern-header';

export interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  layout: TemplateLayout;
  accent: string;
  accentText?: string;
  font: 'sans' | 'serif' | 'mixed';
  headingCase: 'upper' | 'title';
  divider: 'line' | 'bar' | 'none' | 'dot';
  density: 'comfortable' | 'compact';
  sectionOrder: SectionId[];
  atsScore: number;
  tags: string[];
}

export interface DocumentSettings {
  templateId: string;
  pageSize: 'a4' | 'letter';
  accentOverride?: string;
  densityOverride?: 'comfortable' | 'compact';
  sectionOrderOverride?: SectionId[];
  hiddenSections: SectionId[];
  /** One format per application. PDF by default; change it in the management page. */
  outputFormat: DocFormat;
  /** 'tailored' rewrites the headline per job; 'profile' always uses your profile headline. */
  headlineMode: 'tailored' | 'profile';
  /** Override: allow generating documents even when no job description was found. */
  allowGenerateWithoutDescription: boolean;
  /** Attach the user's own uploads instead of the generated files. */
  fileSource: 'generated' | 'uploaded';
  uploadedResumeId?: string;
  uploadedCoverLetterId?: string;
  includePhoto: boolean;
  customFont?: { name: string; dataUrl: string };
  fileNamePattern: string;
}

/* ------------------------------------------------------------------ */
/* Automation                                                          */
/* ------------------------------------------------------------------ */

export interface RuleDef {
  id: string;
  label: string;
  description: string;
  group: 'filters' | 'behaviour' | 'privacy';
  defaultEnabled: boolean;
  configurable?: 'number' | 'text' | 'list';
  defaultValue?: string | number;
}

export interface AutomationSettings {
  enabled: boolean;
  mode: 'assist' | 'auto';
  autoSubmit: boolean;
  dailyLimit: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  matchThreshold: number;
  minConfidenceToSubmit: number;
  rules: Record<string, { enabled: boolean; value?: string | number }>;
  neverSubmitDomains: string[];
  allowlistEnabled: boolean;
  allowlist: string[];
  huntEnabled: boolean;
  huntKeywords: string;
  huntLocations: string;
  maxPagesPerRun: number;
  workingHours: { enabled: boolean; start: number; end: number; days: number[] };
  notifyOnIssue: boolean;
}

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

export type TaskId = 'parseResume' | 'analyzeJob' | 'tailorResume' | 'coverLetter' | 'answerQuestions' | 'matchScore';

export interface PromptConfig {
  globalInstructions: string;
  tone: 'professional' | 'confident' | 'enthusiastic' | 'concise' | 'warm';
  writingStyle: string;
  avoidWords: string[];
  emphasize: string[];
  templates: Partial<Record<TaskId, string>>;
}

/* ------------------------------------------------------------------ */
/* Autofill                                                            */
/* ------------------------------------------------------------------ */

export interface AutofillSettings {
  enabled: boolean;
  fillSensitive: boolean;
  overwriteExisting: boolean;
  highlightFilled: boolean;
  answersBank: { id: ID; question: string; answer: string; tags: string[] }[];
}

/* ------------------------------------------------------------------ */
/* Settings aggregate                                                  */
/* ------------------------------------------------------------------ */

export interface UISettings {
  theme: 'dark' | 'light' | 'system';
  accent: string;
  compactDensity: boolean;
  autoOpenSidePanel: boolean;
  /** Show the floating JobPaal button and panel on web pages. */
  showOverlay: boolean;
}

export interface TermsSettings {
  /** Version of the terms the user last accepted. */
  version: number;
  acceptedAt?: number;
}

export interface AppSettings {
  version: number;
  ai: AIConfig;
  prompts: PromptConfig;
  document: DocumentSettings;
  automation: AutomationSettings;
  autofill: AutofillSettings;
  ui: UISettings;
  terms: TermsSettings;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export interface PageContext {
  url: string;
  title: string;
  site: JobSite | 'linkedin-profile' | 'other';
  hasJob: boolean;
  hasApplicationForm: boolean;
  jobTitle?: string;
  company?: string;
  jobId?: ID;
  applicationId?: ID;
  easyApply?: boolean;
}

export interface MatchResult {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  recommendation: 'strong_match' | 'good_match' | 'stretch' | 'weak_match';
}

export interface AgentState {
  running: boolean;
  paused: boolean;
  mode: 'assist' | 'auto';
  appliedToday: number;
  lastRunAt?: number;
  queue: AgentQueueItem[];
  currentItem?: AgentQueueItem;
  log: { at: number; level: 'info' | 'warn' | 'error' | 'success'; message: string }[];
  stats: { applied: number; skipped: number; failed: number; needsAttention: number };
}

export interface AgentQueueItem {
  id: ID;
  url: string;
  title: string;
  company: string;
  site: JobSite;
  status: 'queued' | 'processing' | 'done' | 'failed' | 'skipped' | 'needs-attention';
  reason?: string;
  matchScore?: number;
  addedAt: number;
}

export interface StoredApplicationEvent {
  type: 'application-created' | 'document-created' | 'application-updated' | 'agent-event';
  applicationId?: ID;
  at: number;
  detail?: string;
}
