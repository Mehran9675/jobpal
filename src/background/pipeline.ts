import type {
  ApplicationQuestion,
  ApplicationRecord,
  DocFormat,
  DocKind,
  DocumentRecord,
  ExtractedJob,
  ID,
  JobAnalysis,
  JobRecord,
} from '@/types';
import { getSettings, getDefaultProfile, getProfiles } from '@/lib/storage';
import { findJobByUrl, getApplication, getApplicationByJob, listApplications, listJobs, recordEvent, saveApplication, saveDocument, saveJob } from '@/lib/db';
import { findApplicationForUrl, findJobForUrl } from '@/lib/applications/match';
import { getTemplate } from '@/lib/doc/templates';
import { renderFiles, type RenderedFile } from '@/lib/doc/renderer';
import { serializeAnswersContent, serializeCoverLetterContent, serializeResumeContent } from '@/lib/doc/content';
import { analyzeJob, answerQuestions, coverLetter, tailorResume, type TaskContext } from '@/lib/ai/tasks';
import { buildTaskContext } from './ai-router';
import { AppError } from '@/lib/errors';
import { uid } from '@/lib/utils';

export interface TailorOptions {
  profileId?: ID;
  kinds?: DocKind[];
  formats?: DocFormat[];
  questions?: ApplicationQuestion[];
  forceAnalysis?: boolean;
  source?: 'manual' | 'agent';
  applicationId?: ID;
  /** Signals detected on the application form. */
  form?: { hasCoverLetterField?: boolean };
  /** One-off confirmation from the user to generate without a description. */
  allowNoDescription?: boolean;
  shouldCancel?: () => boolean;
  onProgress?: (message: string) => void;
}

export interface TailorResult {
  application: ApplicationRecord;
  job: JobRecord;
  analysis: JobAnalysis;
  documents: DocumentRecord[];
  skipped?: string;
}

export async function upsertJob(input: ExtractedJob): Promise<JobRecord> {
  const jobs = await listJobs();
  // Same posting, different route/query? Reuse the existing record so one job
  // never becomes two tracked applications.
  const existing = (await findJobByUrl(input.canonicalUrl)) ?? findJobForUrl(jobs, input.url, input.title, input.company) ?? undefined;
  const record: JobRecord = {
    id: existing?.id ?? uid('job'),
    url: input.url,
    canonicalUrl: input.canonicalUrl || existing?.canonicalUrl || input.url,
    site: input.site,
    title: input.title || existing?.title || '',
    company: input.company || existing?.company || 'Unknown company',
    location: input.location ?? existing?.location,
    remote: input.remote ?? existing?.remote,
    employmentType: input.employmentType ?? existing?.employmentType,
    salary: input.salary ?? existing?.salary,
    description: input.description || existing?.description || '',
    requirements: input.requirements.length > 0 ? input.requirements : existing?.requirements ?? [],
    keywords: input.keywords.length > 0 ? input.keywords : existing?.keywords ?? [],
    postedAt: input.postedAt ?? existing?.postedAt,
    scrapedAt: Date.now(),
    matchScore: existing?.matchScore,
    matchReasons: existing?.matchReasons ?? [],
    missingSkills: existing?.missingSkills ?? [],
    analysis: existing?.analysis,
    questions: existing?.questions ?? [],
  };
  await saveJob(record);
  return record;
}

export async function tailorForJob(input: ExtractedJob, options: TailorOptions = {}): Promise<TailorResult> {
  const settings = await getSettings();
  const profiles = await getProfiles();
  const profile = (options.profileId ? profiles.find((item) => item.id === options.profileId) : undefined) ?? (await getDefaultProfile());
  const job = await upsertJob(input);
  const taskContext = buildTaskContext(settings, profile);
  const guard = () => {
    if (options.shouldCancel?.()) throw new AppError('Stopped. Nothing else was generated.', 'CANCELLED');
  };
  const progress = (message: string) => options.onProgress?.(message);

  // Tailoring needs something to tailor against. The overlay asks the user to
  // confirm (which sets allowNoDescription), and the management page has a
  // persistent override for people who want it permanently.
  if (job.description.trim().length < 80 && settings.document.allowGenerateWithoutDescription !== true && options.allowNoDescription !== true) {
    throw new AppError(
      'No job description was found. Pick it on the page or paste it in the JobPal overlay first (or confirm the override it offers).',
      'DESCRIPTION_REQUIRED',
    );
  }

  guard();
  if (!job.analysis || options.forceAnalysis) {
    progress('Analysing the job posting…');
    job.analysis = await analyzeJob(taskContext, job);
    job.matchScore = job.analysis.matchScore;
    job.matchReasons = job.analysis.matchedSkills;
    job.missingSkills = job.analysis.missingSkills;
    job.keywords = job.analysis.keywords;
    await saveJob(job);
  }
  guard();
  const analysis = job.analysis;

  let application = options.applicationId
    ? await getApplication(options.applicationId)
    : (await getApplicationByJob(job.id)) ?? findApplicationForUrl(await listApplications(), job.url, job.title, job.company);

  const now = Date.now();
  if (!application) {
    application = {
      id: uid('app'),
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      jobUrl: job.url,
      site: job.site,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      documents: [],
      answers: [],
      timeline: [{ at: now, label: 'Application created by JobPal', status: 'draft' }],
      notes: '',
      source: options.source ?? 'manual',
      autoSubmitted: false,
      matchScore: analysis.matchScore,
    };
    await saveApplication(application);
    await recordEvent({ type: 'application-created', applicationId: application.id, detail: `${job.title} at ${job.company}` });
  } else {
    application = {
      ...application,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      jobUrl: job.url,
      matchScore: analysis.matchScore,
      updatedAt: now,
    };
  }

  const questions = options.questions ?? job.questions;
  const rules = settings.automation.rules;
  const requestedKinds = options.kinds;
  // Cover letters are only auto-generated when the application form actually
  // has a field for one (or when the user explicitly asks for it).
  const includeCoverLetter = requestedKinds
    ? requestedKinds.includes('cover_letter')
    : Boolean(options.form?.hasCoverLetterField) && rules['always-cover-letter']?.enabled !== false;
  const includeAnswers = questions.length > 0 && (requestedKinds ? requestedKinds.includes('answers') : rules['answer-screening']?.enabled !== false);
  const baseKinds: DocKind[] = requestedKinds ?? [
    'resume',
    ...(includeCoverLetter ? (['cover_letter'] as DocKind[]) : []),
    ...(includeAnswers ? (['answers'] as DocKind[]) : []),
  ];

  progress('Writing your resume…');
  const tailored = await tailorResume(taskContext, job, analysis);
  if (settings.document.headlineMode === 'profile') {
    tailored.contact = { ...tailored.contact, headline: profile.contact.headline };
  }
  // The letter and answers build on the already-tailored profile, so the
  // job-aligned headline and summary feed every document.
  const tailoredContext: TaskContext = { ...taskContext, profile: tailored };
  let letterText: string | undefined;
  if (includeCoverLetter) {
    guard();
    progress('Writing your cover letter…');
    letterText = await coverLetter(tailoredContext, job, analysis);
  }
  guard();
  const answeredQuestions = includeAnswers ? await answerQuestionsWithProgress(tailoredContext, job, questions, progress) : questions;

  guard();
  progress('Rendering documents…');
  const template = getTemplate(settings.document.templateId);
  const rendered = await renderFiles({
    kinds: baseKinds,
    formats: options.formats ?? [settings.document.outputFormat],
    profile: tailored,
    template,
    settings: settings.document,
    target: { title: job.title, company: job.company, url: job.url, keywords: analysis.keywords },
    coverLetterText: letterText,
    answers: answeredQuestions,
    analysis,
  });

  const documents = await storeRendered(rendered, application.id, job, {
    resume: serializeResumeContent(tailored),
    ...(letterText ? { cover_letter: serializeCoverLetterContent(letterText) } : {}),
    ...(answeredQuestions.length > 0 ? { answers: serializeAnswersContent(answeredQuestions) } : {}),
  });
  progress('Saving files…');
  application = {
    ...application,
    documents: [...new Set([...application.documents, ...documents.map((document) => document.id)])],
    answers: answeredQuestions
      .filter((question) => question.answer)
      .map((question) => ({ question: question.label, answer: question.answer ?? '', required: question.required })),
    timeline: [...application.timeline, { at: Date.now(), label: 'Documents generated with the current design' }],
    updatedAt: Date.now(),
  };
  await saveApplication(application);
  await recordEvent({ type: 'document-created', applicationId: application.id, detail: documents.map((document) => document.filename).join(', ') });

  return { application, job, analysis, documents };
}

async function answerQuestionsWithProgress(
  context: TaskContext,
  job: JobRecord,
  questions: ApplicationQuestion[],
  progress: (message: string) => void,
): Promise<ApplicationQuestion[]> {
  progress(`Answering ${questions.length} screening question${questions.length === 1 ? '' : 's'}…`);
  return answerQuestions(context, job, questions);
}

async function storeRendered(
  files: RenderedFile[],
  applicationId: ID,
  job: JobRecord,
  contentByKind: Partial<Record<DocKind, string>> = {},
): Promise<DocumentRecord[]> {
  const documents: DocumentRecord[] = [];
  for (const file of files) {
    const record: DocumentRecord = {
      id: uid('doc'),
      applicationId,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      kind: file.kind,
      format: file.format,
      filename: file.filename,
      mime: file.mime,
      size: file.blob.size,
      templateId: file.templateId,
      createdAt: Date.now(),
      blob: file.blob,
      textPreview: file.preview?.slice(0, 4000),
      content: contentByKind[file.kind],
    };
    await saveDocument(record);
    documents.push(record);
  }
  return documents;
}

export async function buildTaskContextForProfile(profileId?: ID): Promise<{ context: TaskContext; profileName: string }> {
  const settings = await getSettings();
  const profiles = await getProfiles();
  const profile = (profileId ? profiles.find((item) => item.id === profileId) : undefined) ?? (await getDefaultProfile());
  return { context: buildTaskContext(settings, profile), profileName: profile.variantName };
}

export async function updateApplicationStatus(
  id: ID,
  patch: Partial<ApplicationRecord> & { statusNote?: string },
): Promise<ApplicationRecord> {
  const application = await getApplication(id);
  if (!application) throw new Error('Application not found');
  const now = Date.now();
  const timeline = [...application.timeline];
  if (patch.status && patch.status !== application.status) {
    timeline.push({ at: now, label: `Status changed to ${patch.status}`, status: patch.status, note: patch.statusNote });
  }
  const updated: ApplicationRecord = {
    ...application,
    ...patch,
    timeline,
    updatedAt: now,
    appliedAt: patch.status === 'applied' && !application.appliedAt ? now : application.appliedAt,
  };
  delete (updated as unknown as Record<string, unknown>).statusNote;
  await saveApplication(updated);
  await recordEvent({ type: 'application-updated', applicationId: id, detail: patch.status ? `status=${patch.status}` : 'details updated' });
  return updated;
}
