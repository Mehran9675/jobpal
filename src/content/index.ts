import { createRouter } from '@/lib/messaging';
import { getSettings, watchStorage } from '@/lib/storage';
import { ensureOverlay, overlayMounted, refreshContext, setGuideOpen, setProgress, setStatus, toggleOverlay } from './overlay';
import * as actions from './actions';

const router = createRouter();
const isTopFrame = window.top === window.self;

/* Every frame takes part in the pick relay so fields inside (cross-origin)
   iframes can be selected; only the top frame owns the overlay. */
router.handle('frame.pickStart', ({ token, target }) => actions.startFrameJobPick(token, target));
router.handle('frame.pickStop', ({ token }) => {
  actions.stopFrameJobPick(token);
});

if (isTopFrame) {
  router.handle('frame.pickDone', ({ token, result }) => {
    actions.resolveFramePick(token, result);
  });

  registerPageHandlers();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mount();
      watchNavigation();
    });
  } else {
    mount();
    watchNavigation();
  }

  watchStorage((changes) => {
    if (changes['jobpal.settings'] && overlayMounted()) void refreshContext();
  });

  chrome.runtime.onMessage.addListener((message: { type?: string; name?: string; data?: unknown }) => {
    if (message?.type !== 'jobpal:event' || !overlayMounted()) return false;
    if (message.name === 'pipeline-progress') {
      const progress = message.data as { message?: string } | undefined;
      if (progress?.message) setProgress(progress.message);
      return false;
    }
    if (message.name === 'job-updated' || message.name === 'applications-changed') {
      void refreshContext();
    }
    return false;
  });
}

router.install();

function registerPageHandlers(): void {
  router.handle('page.getContext', async () => {
    const context = actions.buildContext();
    if (!context.hasJob) {
      const manual = await actions.manualJob().catch(() => null);
      if (manual) {
        context.hasJob = true;
        context.jobTitle = context.jobTitle ?? manual.title;
        context.company = context.company ?? manual.company;
      }
    }
    return context;
  });
  router.handle('page.extractJob', () => actions.extractJobResolved());
  router.handle('page.scanLinkedInProfile', () => actions.scanLinkedInProfile());
  router.handle('page.scanLinkedInJobs', () => actions.scanJobListings());
  router.handle('page.detectForm', () => actions.detectForm());
  router.handle('page.fillForm', (payload) => actions.fillForm(payload ?? {}));
  router.handle('page.submitForm', () => actions.submitForm());
  router.handle('page.advanceStep', () => actions.advanceStep());
  router.handle('page.collectFormSnapshot', () => actions.collectFormSnapshot());
  router.handle('page.pickField', (payload) => actions.pickJobField(payload.target));
  router.handle('page.getPicks', () => actions.getPicks());
  router.handle('page.pickAnswerTarget', ({ question, answer }) => actions.pickAnswerTarget(question, answer));
  router.handle('page.pickFileTarget', ({ documentId, kind }) => actions.pickFileTarget(documentId, kind));
  router.handle('page.setPastedDescription', ({ text, title, company }) => {
    actions.setPastedDescription(text, title, company);
  });
  router.handle('page.getPastedDescription', () => actions.getPastedDescription());
  router.handle('page.manualJob', () => actions.manualJob());
  router.handle('page.pickFormField', () => actions.pickFormField());
  router.handle('page.getMappings', () => actions.getMappings());
  router.handle('page.setMapping', ({ selector, key, label }) => {
    actions.setMapping(selector, key as import('@/lib/autofill/fields').FieldKey, label);
  });
  router.handle('page.saveRecipe', () => actions.persistRecipe());
  router.handle('page.forgetRecipe', async () => {
    await actions.forgetRecipe();
  });
  router.handle('page.hasRecipe', () => actions.hasRecipe());
  router.handle('page.jobStatus', () => actions.getJobStatus());
  router.handle('page.useStoredJob', ({ jobId }) => actions.useStoredJob(jobId).then((ok) => ({ ok })));
  router.handle('page.clearStoredJob', () => {
    actions.clearStoredJob();
  });
  router.handle('page.openOverlayPanel', async () => {
    ensureOverlay();
    toggleOverlay(true);
  });
  router.handle('page.openGuide', async () => {
    ensureOverlay();
    setGuideOpen(true);
    toggleOverlay(true);
  });
  router.handle('page.highlight', async () => undefined);
}

function shouldMount(): boolean {
  // Autodetect: the floating button shows up on job postings and application
  // forms. On anything else it stays hidden, but the popup ("Select fields"),
  // the side panel and the context menus force-mount the overlay on demand.
  if (!location.protocol.startsWith('http')) return false;
  const context = actions.buildContext();
  return context.site !== 'other' || context.hasJob || context.hasApplicationForm;
}

function mount(): void {
  if (overlayMounted()) {
    void refreshContext();
    return;
  }
  if (!shouldMount()) return;
  ensureOverlay();
  void refreshContext();
  void getSettings().then((settings) => {
    if (settings.ui.autoOpenSidePanel) setStatus('JobPal is ready - tailor your documents for this page.', 'info');
  });
}

let lastUrl = location.href;

function watchNavigation(): void {
  const check = () => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    setTimeout(() => {
      if (overlayMounted()) void refreshContext();
      else mount();
    }, 1200);
  };
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function patched(this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      check();
      return result;
    };
  }
  window.addEventListener('popstate', check);
  setInterval(check, 2000);
}

export { router };
