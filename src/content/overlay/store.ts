import { useSyncExternalStore } from 'react';
import type { DocumentRecord, ExtractedJob, MatchResult, PageContext } from '@/types';

export interface OverlayPosition {
  left: number;
  top: number;
}

export interface OverlayState {
  context: PageContext;
  job: ExtractedJob | null;
  /** Detection health: issues that need manual work (drives the FAB colour). */
  health: { ok: boolean; issues: string[] };
  documents: DocumentRecord[];
  applicationId?: string;
  busy: boolean;
  status: string;
  statusTone: 'info' | 'success' | 'warn' | 'error';
  match: MatchResult | null;
  matchOpen: boolean;
  aiReady: boolean;
  aiReason?: string;
  guideOpen: boolean;
  picking: boolean;
  picks: Record<string, { value: string; selector: string }>;
  bank: { id: string; question: string; answer: string }[];
  mappings: { selector: string; key: string; label?: string }[];
  filesLoading: boolean;
  answers: { question: string; answer: string; required?: boolean }[];
  pastedFields: Record<string, string>;
  openDocMenu?: string;
  fileSource: 'generated' | 'uploaded';
  uploaded: DocumentRecord[];
  tokensToday: number;
  tokensTotal: number;
  view: 'main' | 'documents';
  allDocuments: DocumentRecord[];
  allDocsLoading: boolean;
  jobSource: 'page' | 'stored' | 'manual' | 'none';
  descriptionWords: number;
  allowNoDescription: boolean;
  confirmNoDescription: boolean;
  showDescription: boolean;
  jobPickerOpen: boolean;
  recentJobs: { id: string; title: string; company: string; url: string; words: number; scrapedAt: number }[];
  recentJobsLoading: boolean;
  panelOpen: boolean;
  showOverlay: boolean;
  termsAccepted: boolean;
  scale: number;
  positionVersion: number;
  /* Content editor (opened from a document row). */
  editorDocumentId?: string;
  editorLoading: boolean;
  editorBusy: boolean;
  editorError?: string;
  editorOriginal?: string;
}

export const OVERLAY_FONT =
  "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Segoe UI Symbol', 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";

const FAB_POSITION_KEY = 'jobpal.overlay.fab';
const PANEL_POSITION_KEY = 'jobpal.overlay.panel';
const LEGACY_POSITION_KEY = 'jobpal.overlay.position';
const SCALE_KEY = 'jobpal.overlay.scale';
export const SCALE_MIN = 0.85;
export const SCALE_MAX = 1.6;
export const SCALE_STEP = 0.15;

const initialState: OverlayState = {
  context: { url: typeof location !== 'undefined' ? location.href : '', title: '', site: 'other', hasJob: false, hasApplicationForm: false },
  job: null,
  health: { ok: true, issues: [] },
  documents: [],
  busy: false,
  status: '',
  statusTone: 'info',
  match: null,
  matchOpen: false,
  aiReady: false,
  guideOpen: false,
  picking: false,
  picks: {},
  bank: [],
  mappings: [],
  filesLoading: false,
  answers: [],
  pastedFields: {},
  fileSource: 'generated',
  uploaded: [],
  tokensToday: 0,
  tokensTotal: 0,
  view: 'main',
  allDocuments: [],
  allDocsLoading: false,
  jobSource: 'none',
  descriptionWords: 0,
  allowNoDescription: false,
  confirmNoDescription: false,
  showDescription: false,
  jobPickerOpen: false,
  recentJobs: [],
  recentJobsLoading: false,
  panelOpen: false,
  showOverlay: true,
  termsAccepted: false,
  scale: 1,
  positionVersion: 0,
  editorLoading: false,
  editorBusy: false,
};

let state: OverlayState = initialState;
const listeners = new Set<() => void>();

export function getOverlayState(): OverlayState {
  return state;
}

export function patchOverlay(patch: Partial<OverlayState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribeOverlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOverlayState(): OverlayState {
  return useSyncExternalStore(subscribeOverlay, getOverlayState, getOverlayState);
}

/** Forces panel elements to re-measure (used after drags and size changes). */
export function nudgePositions(): void {
  patchOverlay({ positionVersion: state.positionVersion + 1 });
}

let fabPosition: OverlayPosition | null = null;
let panelPosition: OverlayPosition | null = null;

export function getFabPosition(): OverlayPosition | null {
  return fabPosition;
}

export function getPanelPosition(): OverlayPosition | null {
  return panelPosition;
}

export function isPosition(value: unknown): value is OverlayPosition {
  return Boolean(value) && typeof (value as OverlayPosition).left === 'number' && typeof (value as OverlayPosition).top === 'number';
}

export function saveFabPosition(position: OverlayPosition): void {
  fabPosition = position;
  void chrome.storage.local.set({ [FAB_POSITION_KEY]: position });
  // A default-anchored panel always sits next to the button, so re-measure it.
  if (!panelPosition) nudgePositions();
}

export function savePanelPosition(position: OverlayPosition): void {
  panelPosition = position;
  void chrome.storage.local.set({ [PANEL_POSITION_KEY]: position });
}

export function setOverlayScale(scale: number): void {
  const clamped = Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale)) * 100) / 100;
  if (clamped === state.scale) return;
  void chrome.storage.local.set({ [SCALE_KEY]: clamped });
  patchOverlay({ scale: clamped });
}

export async function loadOverlayPreferences(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get([FAB_POSITION_KEY, PANEL_POSITION_KEY, LEGACY_POSITION_KEY, SCALE_KEY]);
    const fab = stored[FAB_POSITION_KEY];
    const panel = stored[PANEL_POSITION_KEY];
    const legacy = stored[LEGACY_POSITION_KEY];
    if (isPosition(fab)) fabPosition = fab;
    else if (isPosition(legacy)) fabPosition = legacy;
    if (isPosition(panel)) panelPosition = panel;
    const scale = stored[SCALE_KEY];
    if (typeof scale === 'number' && scale >= SCALE_MIN && scale <= SCALE_MAX) patchOverlay({ scale });
    nudgePositions();
  } catch {
    fabPosition = null;
    panelPosition = null;
  }
}
