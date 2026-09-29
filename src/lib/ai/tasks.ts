import type {
  ApplicationQuestion,
  ChatMessage,
  ChatResult,
  JobAnalysis,
  MatchResult,
  Profile,
  PromptConfig,
  WorkExperience,
} from '@/types';
import { buildSystemPrompt, renderTemplate, taskTemplate } from './prompts';
import { computeMatch, localAnalysis, profileSkillSet, profileSeniority, profileToText } from '@/lib/job/match';
import { buildLocalHeadline, sanitizeHeadline } from './headline';
import { AppError } from '@/lib/errors';
import { parseLooseJson, uid } from '@/lib/utils';

export type ChatRunner = (params: { messages: ChatMessage[]; json?: boolean; temperature?: number; maxTokens?: number }) => Promise<ChatResult>;

export interface TaskContext {
  config: PromptConfig;
  /** Always present: AI-powered features are gated on a connection before they get here. */
  chat: ChatRunner;
  profile: Profile;
  /** Resume wording level from the settings (0 = reworked, 100 = exact). */
  faithfulness?: number;
}

export interface JobLike {
  title: string;
  company: string;
  description: string;
  requirements?: string[];
  keywords?: string[];
  employmentType?: string;
}

function profileJson(profile: Profile): string {
  return JSON.stringify(
    {
      contact: profile.contact,
      presence: profile.presence,
      summary: profile.summary,
      skills: profile.skills,
      experience: profile.experience,
      education: profile.education,
      certifications: profile.certifications,
      languages: profile.languages,
      projects: profile.projects,
      awards: profile.awards,
      eligibility: profile.eligibility,
    },
    null,
    1,
  );
}

async function runJsonTask<T>(
  ctx: TaskContext,
  task: Parameters<typeof buildSystemPrompt>[1],
  template: string,
  vars: Record<string, string>,
): Promise<T> {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(ctx.config, task, ctx.faithfulness) },
    { role: 'user', content: renderTemplate(template, vars) },
  ];
  const result = await ctx.chat({ messages, json: true });
  const parsed = parseLooseJson<T>(result.text);
  if (parsed === null) {
    throw new AppError(
      `The AI returned a response that could not be parsed for “${task}”. Nothing was saved - press the action again to retry.`,
      'AI_ERROR',
    );
  }
  return parsed;
}

async function runTextTask(
  ctx: TaskContext,
  task: Parameters<typeof buildSystemPrompt>[1],
  template: string,
  vars: Record<string, string>,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(ctx.config, task, ctx.faithfulness) },
    { role: 'user', content: renderTemplate(template, vars) },
  ];
  const result = await ctx.chat({ messages });
  const text = result.text.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
  if (!text) {
    throw new AppError(`The AI returned an empty response for “${task}”. Nothing was saved - press the action again to retry.`, 'AI_ERROR');
  }
  return text;
}

export async function analyzeJob(ctx: TaskContext, job: JobLike): Promise<JobAnalysis> {
  const extracted = localAnalysis(ctx.profile, job);
  const skills = profileSkillSet(ctx.profile);
  const parsed = await runJsonTask<Partial<JobAnalysis>>(ctx, 'analyzeJob', taskTemplate(ctx.config, 'analyzeJob'), {
    jobDescription: job.description,
    candidateSkills: skills.join(', '),
    candidateSeniority: profileSeniority(ctx.profile),
    candidateSummary: ctx.profile.summary,
  });
  return {
    ...extracted,
    ...parsed,
    title: parsed.title || job.title,
    company: parsed.company || job.company,
    requiredSkills: dedupe(parsed.requiredSkills ?? extracted.requiredSkills),
    preferredSkills: dedupe(parsed.preferredSkills ?? extracted.preferredSkills),
    keywords: dedupe(parsed.keywords ?? extracted.keywords),
    responsibilities: dedupe(parsed.responsibilities ?? extracted.responsibilities),
    cultureSignals: dedupe(parsed.cultureSignals ?? extracted.cultureSignals),
    redFlags: dedupe(parsed.redFlags ?? extracted.redFlags),
    matchedSkills: dedupe(parsed.matchedSkills ?? extracted.matchedSkills),
    missingSkills: dedupe(parsed.missingSkills ?? extracted.missingSkills),
    highlightBullets: dedupe(parsed.highlightBullets ?? extracted.highlightBullets),
    matchScore: typeof parsed.matchScore === 'number' ? clampScore(parsed.matchScore) : extracted.matchScore,
    recommendation: parsed.recommendation ?? extracted.recommendation,
  };
}

export async function matchScore(ctx: TaskContext, job: JobLike): Promise<MatchResult> {
  const extracted = computeMatch(ctx.profile, job);
  const parsed = await runJsonTask<Partial<MatchResult>>(ctx, 'matchScore', taskTemplate(ctx.config, 'matchScore'), {
    profileJson: profileJson(ctx.profile),
    jobDescription: job.description,
  });
  return {
    score: typeof parsed.score === 'number' ? clampScore(parsed.score) : extracted.score,
    matchedSkills: dedupe(parsed.matchedSkills ?? extracted.matchedSkills),
    missingSkills: dedupe(parsed.missingSkills ?? extracted.missingSkills),
    reasons: dedupe(parsed.reasons ?? extracted.reasons),
    recommendation: parsed.recommendation ?? extracted.recommendation,
  };
}

/**
 * Rewrites the resume for a specific job. Every rewritten field comes from the
 * AI; when a field is missing from the response the original profile value is
 * kept untouched (never locally generated prose). The headline is always
 * aimed at the target role so a stale profile headline cannot leak through.
 */
export async function tailorResume(ctx: TaskContext, job: JobLike, analysis: JobAnalysis): Promise<Profile> {
  const parsed = await runJsonTask<Partial<Profile> & { headline?: string }>(ctx, 'tailorResume', taskTemplate(ctx.config, 'tailorResume'), {
    jobTitle: job.title,
    company: job.company,
    seniority: analysis.seniority,
    requiredSkills: analysis.requiredSkills.join(', '),
    preferredSkills: analysis.preferredSkills.join(', '),
    keywords: analysis.keywords.join(', '),
    highlightBullets: analysis.highlightBullets.join('; '),
    profileJson: profileJson(ctx.profile),
    jobDescription: job.description,
  });

  const headline = sanitizeHeadline(parsed.headline) ?? sanitizeHeadline(parsed.contact?.headline) ?? buildLocalHeadline(ctx.profile, analysis);

  return {
    ...ctx.profile,
    contact: { ...ctx.profile.contact, headline },
    summary: typeof parsed.summary === 'string' && parsed.summary.trim().length > 40 ? parsed.summary.trim() : ctx.profile.summary,
    skills: Array.isArray(parsed.skills) && parsed.skills.some((group) => group?.items?.length) ? parsed.skills : ctx.profile.skills,
    experience:
      Array.isArray(parsed.experience) && parsed.experience.length > 0
        ? parsed.experience.map((item, index) => mergeExperience(item, ctx.profile.experience[index] ?? ctx.profile.experience[0]))
        : ctx.profile.experience,
    projects: Array.isArray(parsed.projects) && parsed.projects.length > 0 ? parsed.projects : ctx.profile.projects,
    education: Array.isArray(parsed.education) && parsed.education.length > 0 ? parsed.education : ctx.profile.education,
    certifications: Array.isArray(parsed.certifications) && parsed.certifications.length > 0 ? parsed.certifications : ctx.profile.certifications,
    languages: Array.isArray(parsed.languages) && parsed.languages.length > 0 ? parsed.languages : ctx.profile.languages,
    awards: Array.isArray(parsed.awards) && parsed.awards.length > 0 ? parsed.awards : ctx.profile.awards,
  };
}

function mergeExperience(candidate: WorkExperience, original?: WorkExperience): WorkExperience {
  return {
    id: candidate.id || original?.id || uid('exp'),
    company: candidate.company || original?.company || '',
    title: candidate.title || original?.title || '',
    location: candidate.location ?? original?.location,
    start: candidate.start || original?.start || '',
    end: candidate.end ?? original?.end,
    current: candidate.current ?? original?.current ?? false,
    description: candidate.description || original?.description || '',
    highlights: Array.isArray(candidate.highlights) && candidate.highlights.length > 0 ? candidate.highlights.filter((highlight) => typeof highlight === 'string' && highlight.trim()) : original?.highlights ?? [],
    skills: Array.isArray(candidate.skills) ? candidate.skills : original?.skills ?? [],
    url: candidate.url ?? original?.url,
  };
}

export async function coverLetter(ctx: TaskContext, job: JobLike & { hiringManager?: string }, analysis: JobAnalysis): Promise<string> {
  return runTextTask(ctx, 'coverLetter', taskTemplate(ctx.config, 'coverLetter'), {
    candidateName: `${ctx.profile.contact.firstName} ${ctx.profile.contact.lastName}`.trim(),
    candidateHeadline: ctx.profile.contact.headline ?? profileSeniority(ctx.profile),
    jobTitle: job.title,
    company: job.company,
    hiringManager: job.hiringManager ?? 'Hiring Manager',
    tone: ctx.config.tone,
    highlightBullets: analysis.highlightBullets.join('; '),
    matchedSkills: analysis.matchedSkills.join(', '),
    profileJson: profileJson(ctx.profile),
    jobDescription: job.description,
  });
}

export async function answerQuestions(ctx: TaskContext, job: JobLike, questions: ApplicationQuestion[]): Promise<ApplicationQuestion[]> {
  if (questions.length === 0) return questions;
  const parsed = await runJsonTask<{ answers: { id: string; answer: string }[] }>(ctx, 'answerQuestions', taskTemplate(ctx.config, 'answerQuestions'), {
    jobTitle: job.title,
    company: job.company,
    profileJson: profileJson(ctx.profile),
    questionsJson: JSON.stringify(questions.map(({ id, label, type, maxLength }) => ({ id, label, type, maxLength })), null, 1),
    jobDescription: job.description,
  });
  const byId = new Map((parsed.answers ?? []).map((entry) => [String(entry.id), String(entry.answer ?? '')]));
  return questions.map((question) => {
    const answer = byId.get(question.id);
    if (!answer || answer.trim().length < 2) return { ...question, answer: question.answer ?? '' };
    const trimmed = question.maxLength && answer.length > question.maxLength ? answer.slice(0, question.maxLength) : answer;
    return { ...question, answer: trimmed };
  });
}

export async function parseResumeText(ctx: TaskContext, rawText: string, candidateName = ''): Promise<{ profile: Partial<Profile>; usedAI: boolean }> {
  const parsed = await runJsonTask<Partial<Profile>>(ctx, 'parseResume', taskTemplate(ctx.config, 'parseResume'), {
    candidateName,
    sourceText: rawText.slice(0, 40000),
  });
  return { profile: sanitizeParsedProfile(parsed), usedAI: true };
}

export function sanitizeParsedProfile(input: Partial<Profile>): Partial<Profile> {
  const out: Partial<Profile> = {};
  if (input.contact) {
    out.contact = {
      ...input.contact,
      firstName: input.contact.firstName ?? '',
      lastName: input.contact.lastName ?? '',
      email: input.contact.email ?? '',
      phone: input.contact.phone ?? '',
    };
  }
  if (input.presence) out.presence = { ...input.presence, other: input.presence.other ?? [] };
  if (typeof input.summary === 'string') out.summary = input.summary;
  const arrays: (keyof Profile)[] = ['experience', 'education', 'certifications', 'languages', 'projects', 'awards'];
  for (const key of arrays) {
    const value = input[key];
    if (!Array.isArray(value)) continue;
    (out as Record<string, unknown>)[key] = value.map((item) => ({ ...(item as object), id: (item as { id?: string }).id || uid(String(key).slice(0, 4)) }));
  }
  if (Array.isArray(input.skills)) out.skills = input.skills.filter((group) => group && Array.isArray(group.items));
  if (input.eligibility) {
    out.eligibility = {
      ...input.eligibility,
      workAuthorization: input.eligibility.workAuthorization ?? '',
      requiresSponsorship: input.eligibility.requiresSponsorship ?? null,
      willingToRelocate: input.eligibility.willingToRelocate ?? null,
    };
  }
  return out;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()))];
}

export function profileFingerprint(profile: Profile): string {
  return `${profile.contact.firstName} ${profile.contact.lastName} ${profile.experience.length} ${profile.updatedAt}`;
}

export { profileToText };
