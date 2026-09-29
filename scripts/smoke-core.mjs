import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(tmpdir(), 'jobpaal-smoke-core');
mkdirSync(outDir, { recursive: true });
const bundlePath = join(outDir, 'bundle.mjs');

const entry = `
import { classifyField, buildFieldValues } from './src/lib/autofill/fields.ts';
import { computeMatch, profileSeniority } from './src/lib/job/match.ts';
import { analyzeJob, coverLetter, matchScore, tailorResume } from './src/lib/ai/tasks.ts';
import { buildSystemPrompt, renderTemplate, taskTemplate } from './src/lib/ai/prompts.ts';
import { deepMerge } from './src/lib/defaults.ts';
import { parseLooseJson, tokenize, keywordFrequency } from './src/lib/utils.ts';
import { profileToResume, effectiveSectionOrder } from './src/lib/doc/schema.ts';
import { getTemplate, RESUME_TEMPLATES } from './src/lib/doc/templates.ts';
import { aiStatusFor } from './src/lib/ai/status.ts';
import { PROVIDER_MAP } from './src/lib/ai/providers.ts';
import { DEFAULT_SETTINGS } from './src/lib/defaults.ts';
import { AppError, errorCodeOf, isAIRequiredError } from './src/lib/errors.ts';

const assert = (condition, message) => { if (!condition) throw new Error('ASSERT FAILED: ' + message); };

const profile = {
  id: 'p1', variantName: 'Primary', isDefault: true, updatedAt: Date.now(),
  contact: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+44 20 7946 0000', headline: 'Senior Front-End Developer | Transitioning to Backend' },
  presence: { linkedin: 'https://linkedin.com/in/ada', other: [] },
  summary: 'Principal engineer with 12 years in distributed systems.',
  skills: [{ category: 'Languages', items: ['TypeScript', 'Go', 'Kubernetes', 'AWS'] }],
  experience: [
    { id: 'e1', company: 'Analytical Engines', title: 'Principal Engineer', start: '2020-01', current: true, description: 'Platform group lead.', highlights: ['Scaled pipeline to 4B events/day.'], skills: ['TypeScript', 'Kubernetes'] },
    { id: 'e2', company: 'Babbage Cloud', title: 'Senior Engineer', start: '2016-04', end: '2019-12', current: false, description: '', highlights: [], skills: ['Go'] }
  ],
  education: [], certifications: [], languages: [], projects: [], awards: [],
  eligibility: { workAuthorization: 'Authorised without restriction', requiresSponsorship: false, willingToRelocate: true, desiredSalary: '150000', desiredSalaryCurrency: 'GBP' },
  eeo: { enabled: false }
};

// --- Field classification -------------------------------------------------
assert(classifyField({ label: 'First name' }).key === 'firstName', 'first name');
assert(classifyField({ label: 'Last Name' }).key === 'lastName', 'last name');
assert(classifyField({ label: 'Email address', type: 'email' }).key === 'email', 'email');
assert(classifyField({ label: 'Mobile phone', type: 'tel' }).key === 'phone', 'phone');
assert(classifyField({ label: 'LinkedIn Profile URL' }).key === 'linkedin', 'linkedin');
assert(classifyField({ label: 'Link to your GitHub' }).key === 'github', 'github');
assert(classifyField({ label: 'Do you require sponsorship?' }).key === 'requiresSponsorship', 'sponsorship');
assert(classifyField({ label: 'When can you start?' }).key === 'availableFrom', 'availability');
assert(classifyField({ label: 'Why do you want to work here?' }).key === 'coverLetter', 'cover letter question');
assert(classifyField({ label: 'Resume/CV', type: 'file' }).key === 'resumeFile', 'resume file');
assert(classifyField({ label: 'Company name' }).key !== 'firstName', 'company is not a name field');
assert(classifyField({ autocomplete: 'given-name' }).key === 'firstName', 'autocomplete wins');

const values = buildFieldValues(profile, { enabled: true, fillSensitive: false, overwriteExisting: false, highlightFilled: true, answersBank: [] });
assert(values.fullName === 'Ada Lovelace', 'full name built');
assert(values.linkedin.includes('linkedin.com'), 'linkedin value');
assert(values.yearsExperience !== '0', 'years of experience calculated');

// --- Match scoring --------------------------------------------------------
const job = {
  title: 'Staff Platform Engineer',
  company: 'Northwind',
  description: 'We need a senior engineer with strong TypeScript, Kubernetes and AWS experience to build our platform. Experience with Go is a plus.',
  requirements: ['TypeScript', 'Kubernetes', 'AWS'],
  keywords: ['TypeScript', 'Kubernetes', 'AWS']
};
const match = computeMatch(profile, job);
assert(match.score >= 60 && match.score <= 100, 'match score in range: ' + match.score);
assert(match.matchedSkills.some((skill) => /typescript/i.test(skill)), 'matched typescript');
assert(profileSeniority(profile) === 'principal' || profileSeniority(profile) === 'lead', 'seniority detected: ' + profileSeniority(profile));

const weak = computeMatch(profile, { title: 'Nurse', company: 'Clinic', description: 'Patient care, triage, phlebotomy and clinical documentation.' });
assert(weak.score < match.score, 'irrelevant job scores lower (' + weak.score + ' < ' + match.score + ')');

// --- No local generation fallback -----------------------------------------
const aiCtx = (chat) => ({ config: { ...DEFAULT_SETTINGS.prompts }, profile, chat });

let stopped = false;
try {
  await analyzeJob(aiCtx(async () => { throw new Error('provider down'); }), job);
} catch (error) {
  stopped = true;
}
assert(stopped, 'a failing AI call stops the operation instead of falling back');

let parseStopped = false;
try {
  await matchScore(aiCtx(async () => ({ text: 'sorry, I cannot do that', model: 'm', providerId: 'x' })), job);
} catch (error) {
  parseStopped = errorCodeOf(error) === 'AI_ERROR';
}
assert(parseStopped, 'unparseable AI output is an AI_ERROR, not a local fallback');

let emptyStopped = false;
try {
  await coverLetter(aiCtx(async () => ({ text: '   ', model: 'm', providerId: 'x' })), job, { highlightBullets: [], matchedSkills: [] });
} catch (error) {
  emptyStopped = errorCodeOf(error) === 'AI_ERROR';
}
assert(emptyStopped, 'empty AI output is an AI_ERROR');

const goodMatch = await matchScore(
  aiCtx(async () => ({
    text: JSON.stringify({ score: 88, matchedSkills: ['TypeScript'], missingSkills: [], reasons: ['strong overlap'], recommendation: 'strong_match' }),
    model: 'm',
    providerId: 'x',
  })),
  job,
);
assert(goodMatch.score === 88, 'AI results are used when the call succeeds');

const partial = await tailorResume(
  aiCtx(async () => ({ text: '{"experience": []}', model: 'm', providerId: 'x' })),
  job,
  { highlightBullets: [], matchedSkills: [], requiredSkills: [], preferredSkills: [], keywords: [], seniority: 'senior' },
);
assert(partial.summary === profile.summary, 'fields the AI omits keep the original profile value');
assert(partial.contact.headline.includes('Principal Engineer'), 'local headline fallback uses the candidate’s own title');
assert(!partial.contact.headline.includes('Staff Platform Engineer'), 'the job title is never copied into the headline');
assert(!partial.contact.headline.includes('Transitioning'), 'stale profile headline is never reused');

const withHeadline = await tailorResume(
  aiCtx(async () => ({ text: JSON.stringify({ headline: 'Staff Platform Engineer | TypeScript � Kubernetes', experience: [] }), model: 'm', providerId: 'x' })),
  job,
  { highlightBullets: [], matchedSkills: [], requiredSkills: [], preferredSkills: [], keywords: [], seniority: 'senior' },
);
assert(withHeadline.contact.headline === 'Staff Platform Engineer | TypeScript � Kubernetes', 'AI headline is used verbatim');
assert(DEFAULT_SETTINGS.ai.fallbackToLocal === undefined, 'there is no local fallback setting');

// --- Prompts --------------------------------------------------------------
const system = buildSystemPrompt({ globalInstructions: 'Never lie.', tone: 'concise', writingStyle: '', avoidWords: ['synergy'], emphasize: ['scale'], templates: {} }, 'tailorResume');
assert(system.includes('Never lie.') && system.includes('synergy') && system.includes('scale'), 'system prompt assembled');
const exactPrompt = buildSystemPrompt({ globalInstructions: '', tone: 'professional', writingStyle: '', avoidWords: [], emphasize: [], templates: {} }, 'tailorResume');
assert(exactPrompt.includes('Wording level: EXACT') && exactPrompt.includes('HARD TRUTH RULES'), 'resume tailoring always uses the exact wording level');
const otherTask = buildSystemPrompt({ globalInstructions: '', tone: 'professional', writingStyle: '', avoidWords: [], emphasize: [], templates: {} }, 'coverLetter');
assert(!otherTask.includes('Wording level'), 'wording level only applies to resume tailoring');
const rendered = renderTemplate(taskTemplate({ globalInstructions: '', tone: 'professional', writingStyle: '', avoidWords: [], emphasize: [], templates: {} }, 'analyzeJob'), { jobDescription: 'JD', candidateSkills: 'TS', candidateSeniority: 'senior', candidateSummary: 's' });
assert(rendered.includes('JD') && rendered.includes('TS'), 'template placeholders replaced');

// --- Settings merge with tombstones ---------------------------------------
const merged = deepMerge({ a: 1, document: { customFont: { name: 'x' }, pageSize: 'a4' } }, { document: { customFont: null } });
assert(merged.document.customFont === undefined, 'null tombstone clears a key');
assert(merged.document.pageSize === 'a4', 'unrelated keys survive a patch');
assert(deepMerge({ n: 1 }, { n: 2 }).n === 2, 'values replace');

// --- JSON parsing ---------------------------------------------------------
assert(parseLooseJson('{"a":1}').a === 1, 'plain JSON');
assert(parseLooseJson('Here you go:\\n\\u0060\\u0060\\u0060json\\n{"a":2}\\n\\u0060\\u0060\\u0060').a === 2, 'fenced JSON');
assert(parseLooseJson('{"a":3,}').a === 3, 'trailing comma repaired');
assert(parseLooseJson('not json') === null, 'garbage rejected');

// --- Resume mapping & sections -------------------------------------------
const resume = profileToResume(profile, { template: getTemplate('aurora'), settings: { templateId: 'aurora', pageSize: 'a4', hiddenSections: [], outputFormats: ['pdf'], includePhoto: false, fileNamePattern: 'x' } });
assert(resume.work.length === 2, 'work mapped');
assert(resume.basics.name === 'Ada Lovelace', 'name mapped');
assert(resume.meta.generator === 'JobPaal', 'meta set');
const order = effectiveSectionOrder(getTemplate('aurora'), { templateId: 'aurora', pageSize: 'a4', hiddenSections: ['languages'], outputFormats: ['pdf'], includePhoto: false, fileNamePattern: 'x' });
assert(!order.includes('languages'), 'hidden sections filtered');

// --- Keyword extraction ---------------------------------------------------
const terms = keywordFrequency(job.description, 20).map((entry) => entry.term);
assert(terms.some((term) => /kubernetes|typescript/i.test(term)), 'keywords extracted');
assert(tokenize('a the and with').length === 0, 'stopwords removed');
assert(RESUME_TEMPLATES.length >= 16, 'template catalogue populated');

// --- AI gating ------------------------------------------------------------
const aiSettings = structuredClone(DEFAULT_SETTINGS);
assert(aiStatusFor(aiSettings).ready === false, 'AI features start disabled');
assert(aiStatusFor(aiSettings).reason, 'disabled state explains why');

const noConnection = structuredClone(DEFAULT_SETTINGS);
noConnection.ai.activeProviderId = 'openai';
assert(aiStatusFor(noConnection).ready === false, 'active provider without credentials is not ready');

const connected = structuredClone(DEFAULT_SETTINGS);
connected.ai.activeProviderId = 'openai';
connected.ai.connections.openai = { providerId: 'openai', apiKey: 'sk-test', status: 'untested' };
assert(aiStatusFor(connected).ready === true, 'provider with key is ready');

const failed = structuredClone(DEFAULT_SETTINGS);
failed.ai.activeProviderId = 'openai';
failed.ai.connections.openai = { providerId: 'openai', apiKey: 'sk-test', status: 'error', lastError: 'invalid key' };
assert(aiStatusFor(failed).ready === true, 'a provider that errored stays retryable');
assert(aiStatusFor(failed).reason === 'invalid key', 'the last error is surfaced for retry');

const noKey = structuredClone(DEFAULT_SETTINGS);
noKey.ai.activeProviderId = 'openai';
noKey.ai.connections.openai = { providerId: 'openai', status: 'untested' };
assert(aiStatusFor(noKey).ready === false, 'a provider without credentials is not ready');

const keyless = structuredClone(DEFAULT_SETTINGS);
keyless.ai.activeProviderId = 'ollama';
keyless.ai.connections.ollama = { providerId: 'ollama', status: 'untested' };
assert(aiStatusFor(keyless).ready === true, 'keyless local provider counts as connected');

assert(isAIRequiredError(new AppError('connect AI', 'AI_REQUIRED')), 'AI_REQUIRED propagates');
assert(errorCodeOf(new AppError('connect AI', 'AI_REQUIRED')) === 'AI_REQUIRED', 'error code preserved');
assert(errorCodeOf(new Error('plain')) === 'UNKNOWN', 'unknown errors fall back');

// --- Model catalogue ------------------------------------------------------
assert(PROVIDER_MAP.deepseek.models.some((model) => /4\.1/.test(model.label)), 'DeepSeek V4.1 listed');
assert(PROVIDER_MAP.deepseek.models.some((model) => model.id === 'deepseek-chat'), 'DeepSeek chat alias selectable');
assert(PROVIDER_MAP.openai.models.some((model) => model.id === 'gpt-5.2'), 'GPT-5.2 listed');

console.log('CORE SMOKE TEST PASSED (' + RESUME_TEMPLATES.length + ' templates)');
`;

const result = await build({
  stdin: { contents: entry, resolveDir: root, sourcefile: 'smoke-core.ts', loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: bundlePath,
  alias: { '@': join(root, 'src') },
  logLevel: 'error',
  define: { __TARGET__: '"chrome"', __DEV__: 'false' },
});

if (result.errors.length > 0) {
  console.error(result.errors);
  process.exit(1);
}

try {
  await import(`file://${bundlePath.replace(/\\/g, '/')}`);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
