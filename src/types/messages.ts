import type {
  AnswerRecord,
  ApplicationStatus,
  ChatResult,
  DocFormat,
  DocKind,
  DocumentRecord,
  ExtractedJob,
  ID,
  JobAnalysis,
  JobRecord,
  MatchResult,
  PageContext,
  Profile,
  ProviderConnection,
  ApplicationQuestion,
  BaseResume,
  AgentState,
  ApplicationRecord,
} from './index';

export type FieldPickTarget = 'title' | 'company' | 'location' | 'salary' | 'description';

export interface FramedPickResult {
  target: FieldPickTarget;
  label: string;
  value: string;
  selector: string;
}

export interface RequestMap {
  /* page / content */
  'page.getContext': { req: undefined; res: PageContext };
  'page.extractJob': { req: undefined; res: ExtractedJob | null };
  'page.scanLinkedInProfile': { req: undefined; res: Partial<Profile> };
  'page.scanLinkedInJobs': { req: undefined; res: ExtractedJob[] };
  'page.detectForm': { req: undefined; res: { found: boolean; fields: number; questions: ApplicationQuestion[]; hasCoverLetterField: boolean } };
  'page.fillForm': { req: { documentIds?: ID[]; answers?: AnswerRecord[]; dryRun?: boolean }; res: { filled: number; skipped: number; total: number; fields: { label: string; key: string; confidence: number }[] } };
  'page.submitForm': { req: undefined; res: { submitted: boolean; reason?: string } };
  'page.advanceStep': { req: undefined; res: { advanced: boolean; step: number; label?: string } };
  'page.highlight': { req: { selector?: string }; res: undefined };
  'page.openOverlayPanel': { req: undefined; res: undefined };
  'page.openGuide': { req: undefined; res: undefined };
  'page.collectFormSnapshot': { req: undefined; res: { fields: { selector: string; label: string; type: string; value: string }[]; questions: ApplicationQuestion[] } };

  /* manual guidance (field picker + per-site recipes) */
  'page.pickField': {
    req: { target: FieldPickTarget };
    res: { target: string; label: string; value: string; selector: string } | null;
  };
  'page.getPicks': { req: undefined; res: Record<string, { value: string; selector: string }> };
  'page.manualJob': { req: undefined; res: ExtractedJob | null };
  'page.pickFormField': { req: undefined; res: { selector: string; label: string; key: string; confidence: number } | null };
  'page.pickAnswerTarget': { req: { question: string; answer: string }; res: { selector: string; label: string } | null };
  'page.pickFileTarget': { req: { documentId: ID; kind: string }; res: { selector: string; label: string; attached: boolean } | null };
  'page.setPastedDescription': { req: { text: string; title?: string; company?: string }; res: undefined };
  'page.getPastedDescription': { req: undefined; res: { text: string; title: string; company: string } };
  'page.getMappings': { req: undefined; res: { selector: string; key: string; label?: string }[] };
  'page.setMapping': { req: { selector: string; key: string; label?: string }; res: undefined };
  'page.saveRecipe': { req: undefined; res: { saved: boolean; host: string } };
  'page.forgetRecipe': { req: undefined; res: undefined };
  'page.hasRecipe': { req: undefined; res: boolean };
  'page.jobStatus': {
    req: undefined;
    res: { source: 'page' | 'stored' | 'manual' | 'none'; words: number; title: string; company: string; hasDescription: boolean };
  };
  'page.useStoredJob': { req: { jobId: ID }; res: { ok: boolean } };
  'page.clearStoredJob': { req: undefined; res: undefined };

  /* frame pick relay: the top frame broadcasts a picker to every frame so
     fields inside (cross-origin) iframes can be selected too */
  'frame.pickBroadcast': { req: { token: string; target: FieldPickTarget }; res: undefined };
  'frame.pickStart': { req: { token: string; target: FieldPickTarget }; res: undefined };
  'frame.pickResult': { req: { token: string; result: FramedPickResult | null }; res: undefined };
  'frame.pickDone': { req: { token: string; result: FramedPickResult | null }; res: undefined };
  'frame.pickStop': { req: { token: string }; res: undefined };

  /* jobs */
  'job.save': { req: { job: ExtractedJob }; res: JobRecord };
  'job.forUrl': { req: { url: string; title?: string; company?: string }; res: { job: JobRecord | null } };
  'job.get': { req: { jobId: ID }; res: { job: JobRecord | null } };
  'jobs.recent': {
    req: undefined;
    res: { jobs: { id: ID; title: string; company: string; url: string; words: number; scrapedAt: number }[] };
  };
  'job.analyze': { req: { jobId: ID }; res: JobAnalysis };
  'job.match': { req: { jobId: ID; profileId?: ID }; res: { score: number; reasons: string[]; missing: string[]; matched: string[]; recommendation: MatchResult['recommendation'] } };
  'pipeline.tailor': {
    req: {
      job: ExtractedJob;
      profileId?: ID;
      kinds?: ('resume' | 'cover_letter' | 'answers')[];
      questions?: ApplicationQuestion[];
      form?: { hasCoverLetterField?: boolean };
      allowNoDescription?: boolean;
    };
    res: { applicationId: ID; documents: DocumentRecord[]; analysis: JobAnalysis; answers: AnswerRecord[] };
  };
  'pipeline.cancel': { req: undefined; res: undefined };
  'pipeline.regenerate': { req: { applicationId: ID }; res: undefined };
  'pipeline.answerOne': { req: { question: string; job: ExtractedJob }; res: { answer: string } };
  'doc.render': { req: { applicationId: ID; kinds?: string[]; formats?: DocFormat[] }; res: undefined };
  'doc.preview': { req: { kind?: string; applicationId?: ID }; res: { html: string } };
  'doc.getBlob': { req: { documentId: ID }; res: { base64: string; mime: string; filename: string; kind: string } };
  'doc.getContent': {
    req: { documentId: ID };
    res: { kind: DocKind; filename: string; format: DocFormat; content: string | null; editable: boolean };
  };
  'doc.updateContent': { req: { documentId: ID; content: string }; res: { document: DocumentRecord } };
  'doc.download': { req: { documentId: ID }; res: { ok: boolean; filename: string } };
  'doc.delete': { req: { documentId: ID }; res: undefined };

  /* ai */
  'ai.chat': { req: { messages: { role: 'system' | 'user' | 'assistant'; content: string }[]; json?: boolean; providerId?: string; model?: string; temperature?: number }; res: ChatResult };
  'ai.status': { req: undefined; res: import('./index').AIStatus };
  'ai.test': { req: { connection: ProviderConnection }; res: { ok: boolean; message: string; model?: string } };
  'ai.models': { req: { connection: ProviderConnection }; res: { id: string; label: string }[] };
  'ai.refreshModels': { req: { providerId: string }; res: { models: import('./index').ProviderModel[]; fetchedAt: number } };
  'ai.usage': { req: undefined; res: import('./index').UsageSummary };
  'ai.usage.provider': { req: { providerId?: string }; res: import('./index').ProviderUsageReport };
  'ai.usage.reset': { req: undefined; res: import('./index').UsageSummary };
  'ai.oauth.start': { req: { providerId: string; clientId?: string }; res: { ok: boolean; tokens?: unknown; message?: string } };

  /* profiles & resumes */
  'profile.list': { req: undefined; res: Profile[] };
  'profile.save': { req: { profile: Profile }; res: Profile };
  'profile.delete': { req: { id: ID }; res: undefined };
  'resume.list': { req: undefined; res: BaseResume[] };
  'resume.save': { req: { resume: BaseResume }; res: BaseResume };
  'resume.delete': { req: { id: ID }; res: undefined };
  'resume.parse': { req: { resumeId: ID; profileId?: ID }; res: { profile: Partial<Profile>; usedAI: boolean } };

  /* applications */
  'applications.list': { req: undefined; res: ApplicationRecord[] };
  'applications.update': { req: { id: ID; patch: Partial<ApplicationRecord> & { statusNote?: string } }; res: ApplicationRecord };
  'applications.delete': { req: { id: ID }; res: undefined };
  'applications.export': { req: undefined; res: { json: string } };

  /* documents */
  'documents.list': { req: { applicationId?: ID } | undefined; res: DocumentRecord[] };
  'documents.forUrl': {
    req: { url: string; title?: string; company?: string };
    res: { applicationId?: ID; documents: DocumentRecord[]; answers: AnswerRecord[]; uploaded: DocumentRecord[] };
  };

  /* agent */
  'agent.state': { req: undefined; res: AgentState };
  'agent.start': { req: { mode?: 'assist' | 'auto' }; res: AgentState };
  'agent.stop': { req: undefined; res: AgentState };
  'agent.pause': { req: undefined; res: AgentState };
  'agent.resume': { req: undefined; res: AgentState };
  'agent.enqueue': { req: { jobs: ExtractedJob[] }; res: AgentState };
  'agent.enqueueFromPage': { req: { tabId?: number } | undefined; res: AgentState };
  'agent.retry': { req: { id: ID }; res: AgentState };
  'agent.removeItem': { req: { id: ID }; res: AgentState };
  'agent.clearQueue': { req: undefined; res: AgentState };
  'agent.applyCurrent': { req: { autoSubmit?: boolean }; res: { applicationId?: ID; status: string; message: string } };

  /* settings */
  'settings.get': { req: undefined; res: import('./index').AppSettings };
  'settings.patch': { req: { patch: Record<string, unknown> }; res: import('./index').AppSettings };

  /* misc */
  'app.openOptions': { req: { tab?: string }; res: undefined };
  'app.openSidePanel': { req: undefined; res: undefined };
  'app.notify': { req: { title: string; message: string; level?: 'info' | 'success' | 'warning' | 'error' }; res: undefined };
  'app.clearData': { req: { scope: 'documents' | 'applications' | 'jobs' | 'all' }; res: { cleared: string[] } };
  'app.import': { req: { json: string }; res: { ok: boolean; message: string } };
  'app.contextChanged': { req: undefined; res: undefined };
  'app.documentsChanged': { req: undefined; res: undefined };
  'app.ping': { req: undefined; res: { ok: true; version: string } };
}

export type MessageType = keyof RequestMap;

export interface Request<K extends MessageType = MessageType> {
  type: K;
  payload: RequestMap[K]['req'];
  id?: string;
}

export interface Response<K extends MessageType = MessageType> {
  ok: boolean;
  data?: RequestMap[K]['res'];
  error?: string;
  code?: string;
  id?: string;
}

export type MessageHandler<K extends MessageType = MessageType> = (
  payload: RequestMap[K]['req'],
  sender: chrome.runtime.MessageSender,
) => Promise<RequestMap[K]['res']>;
