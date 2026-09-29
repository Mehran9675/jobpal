import { createRoot, type Root } from 'react-dom/client';
import overlayCss from '../overlay.scss?inline';
import { OverlayApp } from './components/OverlayApp';
import { loadOverlayPreferences, OVERLAY_FONT, patchOverlay, getOverlayState } from './store';
import { refreshContext } from './actions';

let host: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let root: Root | null = null;

export function overlayMounted(): boolean {
  return host !== null;
}

export function getOverlayShadowRoot(): ShadowRoot | null {
  return shadowRoot;
}

function applyStyles(target: ShadowRoot): boolean {
  try {
    if (typeof CSSStyleSheet === 'undefined' || !('adoptedStyleSheets' in Document.prototype)) return false;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(overlayCss);
    target.adoptedStyleSheets = [sheet];
    return true;
  } catch {
    return false;
  }
}

export function ensureOverlay(): void {
  if (host || !document.body) return;
  host = document.createElement('div');
  host.id = 'jobpal-overlay-host';
  host.style.all = 'initial';
  shadowRoot = host.attachShadow({ mode: 'open' });
  if (!applyStyles(shadowRoot)) {
    const style = document.createElement('style');
    style.textContent = overlayCss;
    shadowRoot.append(style);
  }
  const container = document.createElement('div');
  container.style.fontFamily = OVERLAY_FONT;
  shadowRoot.append(container);
  document.documentElement.appendChild(host);
  root = createRoot(container);
  root.render(<OverlayApp />);
  void loadOverlayPreferences();
  void refreshContext();
  // Some single-page apps replace large parts of the DOM; keep our host mounted.
  setInterval(() => {
    if (host && !host.isConnected && document.documentElement) document.documentElement.appendChild(host);
  }, 2500);
}

export function toggleOverlay(open?: boolean): void {
  const next = open ?? !getOverlayState().panelOpen;
  patchOverlay({ panelOpen: next });
  if (next) void refreshContext();
}
