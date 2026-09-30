import type { ApplicationQuestion, ApplicationRecord, DocFormat, DocKind, DocumentRecord, ID, Profile, ProviderConnection } from '@/types';
import type { RequestMap } from '@/types/messages';
import { createRouter, type Router } from '@/lib/messaging';
import { openOptionsPage, runtime, storageLocalGet, storageLocalSet, tabsQuery, tabSendMessage } from '@/lib/browser';
import { deleteProfile, deleteResume, getDefaultProfile, getProfiles, getResumes, getSettings, patchSettings, saveProfile, saveResume } from '@/lib/storage';
import { deleteApplication, deleteDocument, getDocument, getJob, listApplications, listDocuments, listJobs, recordEvent, saveApplication, saveDocument, saveJob, sanitizeDocuments } from '@/lib/db';
import { listModels, testConnection } from '@/lib/ai/client';
import { startOAuthFlow } from '@/lib/ai/oauth';
import { aiStatusFor } from '@/lib/ai/status';
import { getUsage, recordUsage, resetUsage } from '@/lib/ai/usage';
import { fetchProviderUsage } from '@/lib/ai/usage-report';
import { AppError, AI_REQUIRED_MESSAGE } from '@/lib/errors';
import { termsAccepted } from '@/lib/legal';
import { findApplicationForUrl, findJobForUrl } from '@/lib/applications/match';
import { cancelToken, createToken, isCancelled, releaseToken, tokenKeyFor } from './cancel';
import { parseResumeText } from '@/lib/ai/tasks';
import { getTemplate } from '@/lib/doc/templates';
import { previewHtml, renderFiles } from '@/lib/doc/renderer';
import { isEditableKind, serializeAnswersContent, serializeCoverLetterContent, serializeResumeContent } from '@/lib/doc/content';
import { tailorForJob, updateApplicationStatus, upsertJob, buildTaskContextForProfile } from './pipeline';
import { chatWithSettings } from './ai-router';
import { downloadDocument } from './downloads';
import { installNotificationClickHandler, notify } from './notify';
import type { ExtractedJob } from '@/types';

const router: Router = createRouter();

function activeTabId(sender?: chrome.runtime.MessageSender): number | undefined {
  return sender?.tab?.id;
}

function registerHandlers(): void {
  /* ----------------------------- app ----------------------------- */
  router.handle('app.ping', () => ({ ok: true as const, version: runtime.getManifest().version }));
  router.handle('app.openOptions', async ({ tab }) => {
    await openOptionsPage(tab);
  });
  router.handle('app.openSidePanel', async (_payload, sender) => {
    const tabId = activeTabId(sender) ?? (await tabsQuery({ active: true, currentWindow: true }))[0]?.id;
    if (tabId !== undefined && chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ tabId }).catch(async () => {
        await openOptionsPage();
      });
    } else {
      await openOptionsPage();
    }
  });
  router.handle('app.notify', async ({ title, message, level }) => {
    await notify(title, message, level ?? 'info');
  });
  router.handle('app.contextChanged', async () => {
    await broadcast('context-changed');
  });
  router.handle('app.documentsChanged', async () => {
    await broadcast('applications-changed');
  });
  router.handle('app.clearData', async ({ scope }) => {
    const cleared: string[] = [];
    const { idbClear } = await import('@/lib/db');
    if (scope === 'documents' || scope === 'all') {
      await idbClear('documents');
      cleared.push('documents');
    }
    if (scope === 'applications' || scope === 'all') {
      await idbClear('applications');
      await idbClear('events');
      cleared.push('applications');
    }
    if (scope === 'jobs' || scope === 'all') {
      await idbClear('jobs');
      cleared.push('jobs');
    }
    await broadcast('applications-changed');
    return { cleared };
  });
  router.handle('app.import', async ({ json }) => {
    try {
      const parsed = JSON.parse(json) as { settings?: unknown; profiles?: unknown; applications?: unknown };
      if (parsed.settings) await patchSettings(parsed.settings as Record<string, unknown>);
      if (Array.isArray(parsed.profiles)) {
        for (const profile of parsed.profiles as import('@/types').Profile[]) await saveProfile(profile);
      }
      let imported = 0;
      if (Array.isArray(parsed.applications)) {
        for (const application of parsed.applications as import('@/types').ApplicationRecord[]) {
          await saveApplication(application);
          imported++;
        }
      }
      await broadcast('applications-changed');
      return { ok: true, message: `Imported ${imported} application(s) and ${Array.isArray(parsed.profiles) ? parsed.profiles.length : 0} profile(s).` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  });

  /* --------------------------- settings -------------------------- */
  router.handle('settings.get', () => getSettings());
  router.handle('settings.patch', async ({ patch }) => patchSettings(patch));

  /* --------------------------- profiles -------------------------- */
  router.handle('profile.list', () => getProfiles());
  router.handle('profile.save', async ({ profile }) => saveProfile(profile));
  router.handle('profile.delete', async ({ id }) => {
    await deleteProfile(id);
  });

  /* ---------------------------- resumes -------------------------- */
  router.handle('resume.list', () => getResumes());
  router.handle('resume.save', async ({ resume }) => saveResume(resume));
  router.handle('resume.delete', async ({ id }) => {
    await deleteResume(id);
  });
  router.handle('resume.parse', async ({ resumeId, profileId }) => {
    const resumes = await getResumes();
    const resume = resumes.find((item) => item.id === resumeId);
    if (!resume) throw new Error('Resume not found');
    const { context } = await buildTaskContextForProfile(profileId);
    const { profile, usedAI } = await parseResumeText(context, resume.rawText, `${resume.name}`);
    await saveResume({ ...resume, parsed: profile, parsedAt: Date.now() });
    return { profile, usedAI };
  });

  /* ---------------------------- jobs ----------------------------- */
  router.handle('job.save', async ({ job }) => upsertJob(job));
  router.handle('job.forUrl', async ({ url, title, company }) => {
    const jobs = await listJobs();
    return { job: findJobForUrl(jobs, url, title, company) };
  });
  router.handle('job.get', async ({ jobId }) => ({ job: (await getJob(jobId)) ?? null }));
  router.handle('jobs.recent', async () => {
    const jobs = await listJobs();
    return {
      jobs: jobs.slice(0, 30).map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        url: job.url,
        words: job.description ? job.description.trim().split(/\s+/).filter(Boolean).length : 0,
        scrapedAt: job.scrapedAt,
      })),
    };
  });
  router.handle('job.analyze', async ({ jobId }) => {
    const { context } = await buildTaskContextForProfile();
    const { getJob } = await import('@/lib/db');
    const job = await getJob(jobId);
    if (!job) throw new Error('Job not found');
    const { analyzeJob } = await import('@/lib/ai/tasks');
    const analysis = await analyzeJob(context, job);
    await saveJob({ ...job, analysis, matchScore: analysis.matchScore, matchReasons: analysis.matchedSkills, missingSkills: analysis.missingSkills });
    await broadcast('job-updated', { jobId });
    return analysis;
  });
  router.handle('job.match', async ({ jobId, profileId }) => {
    const { getJob } = await import('@/lib/db');
    const job = await getJob(jobId);
    if (!job) throw new Error('Job not found');
    const { context } = await buildTaskContextForProfile(profileId);
    const { matchScore } = await import('@/lib/ai/tasks');
    const result = await matchScore(context, job);
    await saveJob({ ...job, matchScore: result.score, matchReasons: result.matchedSkills, missingSkills: result.missingSkills });
    await broadcast('job-updated', { jobId });
    return { score: result.score, reasons: result.reasons, missing: result.missingSkills, matched: result.matchedSkills, recommendation: result.recommendation };
  });

  /* --------------------------- pipeline -------------------------- */
  router.handle('pipeline.tailor', async (payload, sender) => {
    const key = tokenKeyFor(sender.tab?.id);
    createToken(key);
    try {
      const result = await tailorForJob(payload.job, {
        profileId: payload.profileId,
        kinds: payload.kinds as DocKind[] | undefined,
        questions: payload.questions,
        form: payload.form,
        allowNoDescription: payload.allowNoDescription,
        shouldCancel: () => isCancelled(key),
        onProgress: (message) => void broadcast('pipeline-progress', { key, message }),
      });
      await broadcast('applications-changed', { applicationId: result.application.id });
      return { applicationId: result.application.id, documents: sanitizeDocuments(result.documents), analysis: result.analysis, answers: result.application.answers };
    } finally {
      releaseToken(key);
    }
  });

  router.handle('pipeline.cancel', (_payload, sender) => {
    const key = tokenKeyFor(sender.tab?.id);
    cancelToken(key);
  });

  router.handle('pipeline.answerOne', async ({ question, job }) => {
    const { context } = await buildTaskContextForProfile();
    const { answerQuestions } = await import('@/lib/ai/tasks');
    const [answered] = await answerQuestions(context, job, [{ id: 'manual-question', label: question, type: 'textarea', required: false, answer: '' }]);
    const answer = answered?.answer?.trim();
    if (!answer) throw new AppError('The AI did not return an answer for that question. Nothing was saved - try again.', 'AI_ERROR');
    return { answer };
  });

  router.handle('pipeline.regenerate', async ({ applicationId }) => {
    const applications = await listApplications();
    const application = applications.find((item) => item.id === applicationId);
    if (!application) throw new Error('Application not found');
    const { getJob } = await import('@/lib/db');
    const job = await getJob(application.jobId);
    if (!job) throw new Error('Job data was deleted');
    const settings = await getSettings();
    const profile = (await getProfiles()).find((item) => item.isDefault) ?? (await getDefaultProfile());
    const { analyzeJob } = await import('@/lib/ai/tasks');
    const { context } = await buildTaskContextForProfile(profile.id);
    const analysis = await analyzeJob(context, job);
    const documents = await listDocuments(applicationId);
    await Promise.all(documents.map((document) => deleteDocument(document.id)));
    const template = getTemplate(settings.document.templateId);
    const { renderFiles } = await import('@/lib/doc/renderer');
    const { tailorResume, coverLetter, answerQuestions } = await import('@/lib/ai/tasks');
    const tailored = await tailorResume(context, job, analysis);
    const letter = await coverLetter(context, job, analysis);
    const answered = await answerQuestions(
      context,
      job,
      application.answers.map((answer) => ({ id: answer.question, label: answer.question, type: 'textarea' as const, required: answer.required ?? false, answer: '' })),
    );
    const renderedKinds: DocKind[] = ['resume', 'cover_letter', ...(answered.length > 0 ? (['answers'] as DocKind[]) : [])];
    const regenerateContent: Partial<Record<DocKind, string>> = {
      resume: serializeResumeContent(tailored),
      cover_letter: serializeCoverLetterContent(letter),
      ...(answered.length > 0 ? { answers: serializeAnswersContent(answered) } : {}),
    };
    const rendered = await renderFiles({
      kinds: renderedKinds,
      formats: [settings.document.outputFormat],
      profile: tailored,
      template,
      settings: settings.document,
      target: { title: job.title, company: job.company, url: job.url, keywords: analysis.keywords },
      coverLetterText: letter,
      answers: answered,
      analysis,
    });
    const ids: ID[] = [];
    for (const file of rendered) {
      const document = {
        id: crypto.randomUUID(),
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
        content: regenerateContent[file.kind],
      };
      const { saveDocument } = await import('@/lib/db');
      await saveDocument(document);
      ids.push(document.id);
    }
    await saveApplication({
      ...application,
      documents: ids,
      timeline: [...application.timeline, { at: Date.now(), label: 'Documents regenerated' }],
      updatedAt: Date.now(),
    });
    await broadcast('applications-changed', { applicationId });
  });

  /* --------------------------- documents ------------------------- */
  router.handle('doc.render', async ({ applicationId, kinds, formats }) => {
    const applications = await listApplications();
    const application = applications.find((item) => item.id === applicationId);
    if (!application) throw new Error('Application not found');
    const { getJob } = await import('@/lib/db');
    const job = await getJob(application.jobId);
    if (!job) throw new Error('Job data was missing');
    const settings = await getSettings();
    const profile = await getDefaultProfile();
    const { context } = await buildTaskContextForProfile(profile.id);
    const { analyzeJob, tailorResume, coverLetter, answerQuestions } = await import('@/lib/ai/tasks');
    const analysis = job.analysis ?? (await analyzeJob(context, job));
    const tailored = await tailorResume(context, job, analysis);
    const letter = await coverLetter(context, job, analysis);
    const answered = await answerQuestions(
      context,
      job,
      application.answers.map((answer) => ({ id: answer.question, label: answer.question, type: 'textarea' as const, required: answer.required ?? false, answer: '' })),
    );
    const rendered = await renderFiles({
      kinds: (kinds as DocKind[] | undefined) ?? ['resume', 'cover_letter'],
      formats: (formats as DocFormat[] | undefined) ?? [settings.document.outputFormat],
      profile: tailored,
      template: getTemplate(settings.document.templateId),
      settings: settings.document,
      target: { title: job.title, company: job.company, url: job.url, keywords: analysis.keywords },
      coverLetterText: letter,
      answers: answered,
      analysis,
    });
    const saved: ID[] = [];
    const { saveDocument } = await import('@/lib/db');
    const replaceKinds = new Set((kinds as DocKind[] | undefined) ?? ['resume', 'cover_letter']);
    const renderContent: Partial<Record<DocKind, string>> = {
      ...(replaceKinds.has('resume') ? { resume: serializeResumeContent(tailored) } : {}),
      ...(replaceKinds.has('cover_letter') ? { cover_letter: serializeCoverLetterContent(letter) } : {}),
      ...(replaceKinds.has('answers') && answered.length > 0 ? { answers: serializeAnswersContent(answered) } : {}),
    };
    const existing = await listDocuments(applicationId);
    const replaced = existing.filter((document) => replaceKinds.has(document.kind) && !document.uploaded);
    for (const document of replaced) await deleteDocument(document.id);
    for (const file of rendered) {
      const document = {
        id: crypto.randomUUID(),
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
        content: renderContent[file.kind],
      };
      await saveDocument(document);
      saved.push(document.id);
    }
    const removed = new Set(replaced.map((document) => document.id));
    await saveApplication({
      ...application,
      documents: [...application.documents.filter((id) => !removed.has(id)), ...saved],
      timeline: [...application.timeline, { at: Date.now(), label: `Regenerated: ${[...replaceKinds].join(', ')}` }],
      updatedAt: Date.now(),
    });
    await broadcast('applications-changed', { applicationId });
  });

  router.handle('documents.list', async (payload) => sanitizeDocuments(await listDocuments(payload?.applicationId)));
  router.handle('documents.forUrl', async ({ url, title, company }) => {
    const all = await listDocuments();
    const uploaded = sanitizeDocuments(all.filter((document) => document.uploaded));
    const applications = await listApplications();
    const application = findApplicationForUrl(applications, url, title, company);
    if (!application) return { documents: [], answers: [], uploaded };
    return {
      applicationId: application.id,
      documents: sanitizeDocuments(all.filter((document) => document.applicationId === application.id)),
      answers: application.answers,
      uploaded,
    };
  });
  router.handle('doc.getBlob', async ({ documentId }) => {
    const document = await getDocument(documentId);
    if (!document) throw new Error('Document not found');
    const bytes = new Uint8Array(await document.blob.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return { base64: btoa(binary), mime: document.mime, filename: document.filename, kind: document.kind };
  });
  router.handle('doc.getContent', async ({ documentId }) => {
    const document = await getDocument(documentId);
    if (!document) throw new AppError('Document not found.', 'NOT_FOUND');
    return {
      kind: document.kind,
      filename: document.filename,
      format: document.format,
      content: document.content ?? null,
      editable: isEditableKind(document.kind) && !document.uploaded,
    };
  });
  router.handle('doc.updateContent', async ({ documentId, content }) => {
    const document = await getDocument(documentId);
    if (!document) throw new AppError('Document not found.', 'NOT_FOUND');
    if (!isEditableKind(document.kind) || document.uploaded) throw new AppError('This file has no editable content.', 'UNSUPPORTED');
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AppError('The edited content could not be read. Nothing was changed.', 'INVALID_INPUT');
    }

    const settings = await getSettings();
    const job = document.jobId ? await getJob(document.jobId) : undefined;
    let profile: Profile;
    if (document.kind === 'resume') {
      const candidate = parsed as Profile;
      if (!candidate || typeof candidate !== 'object' || !candidate.contact || !Array.isArray(candidate.experience)) {
        throw new AppError('The resume content is missing required fields (contact, experience).', 'INVALID_INPUT');
      }
      profile = candidate;
    } else {
      profile = await resolveEditedProfile(document.applicationId);
    }

    let coverLetterText: string | undefined;
    let answers: ApplicationQuestion[] | undefined;
    if (document.kind === 'cover_letter') {
      const text = (parsed as { text?: unknown }).text;
      if (typeof text !== 'string' || !text.trim()) throw new AppError('The cover letter text is empty.', 'INVALID_INPUT');
      coverLetterText = text;
    }
    if (document.kind === 'answers') {
      const list = (parsed as { answers?: unknown }).answers;
      if (!Array.isArray(list)) throw new AppError('The answers content could not be read.', 'INVALID_INPUT');
      answers = list.map((entry, index) => ({
        id: `edited-${index}`,
        label: String((entry as { question?: unknown }).question ?? ''),
        answer: String((entry as { answer?: unknown }).answer ?? ''),
        type: 'textarea' as const,
        required: false,
      }));
    }

    const rendered = await renderFiles({
      kinds: [document.kind],
      formats: [document.format],
      profile,
      template: getTemplate(document.templateId ?? settings.document.templateId),
      settings: settings.document,
      target: { title: job?.title ?? document.jobTitle, company: job?.company ?? document.company, url: job?.url, keywords: job?.analysis?.keywords ?? [] },
      coverLetterText,
      answers,
      analysis: job?.analysis,
    });
    const file = rendered[0];
    if (!file) throw new AppError('Nothing could be rendered from the edited content.', 'UNKNOWN');

    const updated: DocumentRecord = {
      ...document,
      filename: file.filename || document.filename,
      mime: file.mime,
      size: file.blob.size,
      blob: file.blob,
      textPreview: file.preview?.slice(0, 4000),
      templateId: file.templateId ?? document.templateId,
      content,
      editedAt: Date.now(),
    };
    await saveDocument(updated);
    await recordEvent({ type: 'document-created', applicationId: document.applicationId, detail: `${file.filename} was edited and re-rendered` });
    await broadcast('applications-changed', { applicationId: document.applicationId });
    return { document: sanitizeDocuments([updated])[0] };
  });
  router.handle('doc.download', async ({ documentId }) => downloadDocument(documentId));
  router.handle('doc.delete', async ({ documentId }) => {
    const document = await getDocument(documentId);
    if (!document) return;
    await deleteDocument(documentId);
    if (document.applicationId) {
      const applications = await listApplications();
      const application = applications.find((item) => item.id === document.applicationId);
      if (application) {
        await saveApplication({ ...application, documents: application.documents.filter((id) => id !== documentId), updatedAt: Date.now() });
      }
    }
    await broadcast('applications-changed', { applicationId: document.applicationId });
  });
  router.handle('doc.preview', async ({ kind, applicationId }) => {
    const settings = await getSettings();
    const profile = await getDefaultProfile();
    const applications = await listApplications();
    const application = applicationId ? applications.find((item) => item.id === applicationId) : undefined;
    const html = previewHtml({
      kind: (kind as DocKind) ?? 'resume',
      profile,
      template: getTemplate(settings.document.templateId),
      settings: settings.document,
      target: application ? { title: application.jobTitle, company: application.company } : undefined,
    });
    return { html };
  });

  /* ------------------------- applications ------------------------ */
  router.handle('applications.list', () => listApplications());
  router.handle('applications.update', async ({ id, patch }) => {
    const updated = await updateApplicationStatus(id, patch as Partial<ApplicationRecord>);
    await broadcast('applications-changed', { applicationId: id });
    return updated;
  });
  router.handle('applications.delete', async ({ id }) => {
    await deleteApplication(id);
    await broadcast('applications-changed', { applicationId: id });
  });
  router.handle('applications.export', async () => {
    const [applications, settings, profiles, resumes] = await Promise.all([listApplications(), getSettings(), getProfiles(), getResumes()]);
    const safeSettings = {
      ...settings,
      ai: {
        ...settings.ai,
        connections: Object.fromEntries(
          Object.entries(settings.ai.connections).map(([id, connection]) => [
            id,
            { ...connection, apiKey: undefined, oauth: undefined },
          ]),
        ),
      },
    };
    const exportObject = {
      exportedAt: new Date().toISOString(),
      generator: 'JobPaal',
      note: 'API keys and OAuth tokens are intentionally excluded from backups.',
      settings: safeSettings,
      profiles,
      resumes: resumes.map((resume) => ({ ...resume, rawText: resume.rawText.slice(0, 20000) })),
      applications: applications.map((application) => ({ ...application })),
    };
    return { json: JSON.stringify(exportObject, null, 2) };
  });

  /* ------------------------------ ai ----------------------------- */
  router.handle('ai.chat', async ({ messages, json, providerId, model, temperature }) =>
    chatWithSettings(messages, { json, providerId, model, temperature }),
  );
  router.handle('ai.status', async () => {
    const settings = await getSettings();
    return aiStatusFor(settings);
  });
  router.handle('ai.test', async ({ connection }) => {
    const typed = connection as ProviderConnection;
    const result = await testConnection(typed);
    await recordUsage(typed.providerId, undefined, !result.ok);
    return result;
  });
  router.handle('ai.models', async ({ connection }) => {
    const models = await listModels(connection as ProviderConnection);
    return models.map((model) => ({ id: model.id, label: model.label }));
  });
  router.handle('ai.refreshModels', async ({ providerId }) => {
    const settings = await getSettings();
    const connection = settings.ai.connections[providerId];
    if (!connection) throw new AppError(`Provider "${providerId}" is not configured.`, 'AI_REQUIRED');
    const models = await listModels({ ...connection, providerId });
    const fetchedAt = Date.now();
    const normalized = models.map((model) => ({ id: model.id, label: model.label, contextWindow: model.contextWindow, tier: model.tier }));
    await patchSettings({ ai: { connections: { [providerId]: { ...connection, models: normalized, modelsFetchedAt: fetchedAt } } } });
    return { models: normalized, fetchedAt };
  });
  router.handle('ai.usage', async () => getUsage());
  router.handle('ai.usage.reset', async () => resetUsage());
  router.handle('ai.usage.provider', async ({ providerId }) => {
    const settings = await getSettings();
    const id = providerId ?? settings.ai.activeProviderId;
    if (!id) throw new AppError(AI_REQUIRED_MESSAGE, 'AI_REQUIRED');
    const connection = settings.ai.connections[id];
    if (!connection) throw new AppError(`Provider "${id}" is not configured.`, 'AI_REQUIRED');
    return fetchProviderUsage(connection);
  });
  router.handle('ai.oauth.start', async ({ providerId, clientId }) => {
    const result = await startOAuthFlow(providerId, clientId);
    if (result.ok && result.tokens) {
      const settings = await getSettings();
      const existing = settings.ai.connections[providerId] ?? { providerId, status: 'untested' as const };
      await patchSettings({
        ai: {
          activeProviderId: settings.ai.activeProviderId ?? providerId,
          connections: { [providerId]: { ...existing, oauth: result.tokens, status: 'untested' } },
        },
      });
    }
    return { ok: result.ok, tokens: result.tokens, message: result.message };
  });

  /* ------------------------ frame pick relay --------------------- */
  router.handle('frame.pickBroadcast', async ({ token, target }, sender) => {
    const tabId = activeTabId(sender);
    if (tabId === undefined) return;
    await tabsBroadcast(tabId, { type: 'frame.pickStart', payload: { token, target } });
  });
  router.handle('frame.pickResult', async ({ token, result }, sender) => {
    const tabId = activeTabId(sender);
    if (tabId === undefined) return;
    await tabsBroadcast(tabId, { type: 'frame.pickDone', payload: { token, result } }, 0);
    await tabsBroadcast(tabId, { type: 'frame.pickStop', payload: { token } });
  });
}

/**
 * For edited cover letters and answers: reuse the newest edited resume of the
 * same application so the header stays consistent, else the default profile.
 */
async function resolveEditedProfile(applicationId?: ID): Promise<Profile> {
  if (applicationId) {
    const resume = (await listDocuments(applicationId))
      .filter((entry) => entry.kind === 'resume' && entry.content)
      .sort((a, b) => (b.editedAt ?? b.createdAt) - (a.editedAt ?? a.createdAt))[0];
    if (resume?.content) {
      try {
        const parsed = JSON.parse(resume.content) as Profile;
        if (parsed?.contact) return parsed;
      } catch {
        /* fall through to the default profile */
      }
    }
  }
  return getDefaultProfile();
}

/** Sends a message to every frame of a tab, or to one frame when frameId is given. */
function tabsBroadcast(tabId: number, message: unknown, frameId?: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      void chrome.runtime.lastError;
      resolve();
    };
    try {
      if (frameId === undefined) chrome.tabs.sendMessage(tabId, message, done);
      else chrome.tabs.sendMessage(tabId, message, { frameId }, done);
    } catch {
      resolve();
    }
  });
}

export async function broadcast(name: string, data?: unknown): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'jobpal:event', name, data });
  } catch {
    /* no listeners */
  }
}

function installContextMenus(): void {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'jobpal-tailor',
      title: 'JobPaal: tailor documents for this job',
      contexts: ['page'],
    });
    chrome.contextMenus.create({ id: 'jobpal-fill', title: 'JobPaal: fill this application form', contexts: ['page'] });
    chrome.contextMenus.create({ type: 'separator', id: 'jobpal-sep', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'jobpal-scan-profile', title: 'JobPaal: scan this LinkedIn profile', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'jobpal-open', title: 'JobPaal: open management page', contexts: ['page', 'action'] });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'jobpal-open') {
      await openOptionsPage();
      return;
    }
    const settings = await getSettings();
    if (!termsAccepted(settings)) {
      await notify('Accept the terms first', 'Open JobPaal and accept the Terms of Use and Privacy Policy before using the extension.', 'warning');
      return;
    }
    if (!tab?.id) return;
    switch (info.menuItemId) {
      case 'jobpal-tailor': {
        const job = await tabSendMessage<{ ok: boolean; data?: ExtractedJob | null }>(tab.id, { type: 'page.extractJob', payload: undefined }).catch(() => undefined);
        if (job?.data) {
          const result = await tailorForJob(job.data, { source: 'manual', kinds: ['resume', 'cover_letter', 'answers'] });
          await notify('Documents ready', 'Your documents are ready to review.', 'success');
          await broadcast('applications-changed', { applicationId: result.application.id });
          await openOptionsPage(`applications/${result.application.id}`);
        } else {
          await notify('No job detected', 'Could not read a job description on this page.', 'warning');
        }
        break;
      }
      case 'jobpal-fill': {
        await tabSendMessage(tab.id, { type: 'page.openOverlayPanel', payload: undefined }).catch(() => undefined);
        const result = await tabSendMessage<{ ok: boolean; data?: { filled: number; total: number } }>(tab.id, { type: 'page.fillForm', payload: {} }).catch(() => undefined);
        if (result?.data) {
          await notify('Form filled', `Filled ${result.data.filled} of ${result.data.total} fields. Review the form, then submit.`, 'success');
        } else {
          await notify('Could not fill the form', 'Open JobPaal on the page and use Fill this form instead.', 'warning');
        }
        break;
      }
      case 'jobpal-scan-profile': {
        await tabSendMessage(tab.id, { type: 'page.openOverlayPanel', payload: undefined }).catch(() => undefined);
        await openOptionsPage('profile');
        break;
      }
      default:
        break;
    }
  });
}

function installLifecycle(): void {
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      await openOptionsPage('welcome');
    }
  });
}

function installSidePanelBehaviour(): void {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
  }
  if (chrome.tabs?.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        void broadcast('tab-updated', { tabId, url: tab.url }).catch(() => undefined);
      }
    });
  }
}

export async function bootstrap(): Promise<void> {
  registerHandlers();
  router.install();
  installContextMenus();
  installLifecycle();
  installNotificationClickHandler();
  installSidePanelBehaviour();
  await storageLocalGet(['jobpal.version']).then(async (items) => {
    if (!items['jobpal.version']) {
      await storageLocalSet({ 'jobpal.version': runtime.getManifest().version });
    }
  });
}

void bootstrap();

export type Handlers = RequestMap;
