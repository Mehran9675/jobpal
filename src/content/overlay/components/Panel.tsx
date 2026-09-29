import { useEffect, useLayoutEffect, useRef } from 'react';
import { applyPosition, clampToViewport, makeDraggable } from '../dom';
import { getPanelPosition, nudgePositions, OVERLAY_FONT, savePanelPosition, useOverlayState } from '../store';
import { PanelHeader } from './PanelHeader';
import { MainView } from './MainView';
import { DocumentsPage } from './DocumentsPage';
import { Show } from '@/ui/components';

const PANEL_WIDTH = 380;
const VIEWPORT_MARGIN = 8;
const MIN_HEIGHT = 240;

export function Panel() {
  const state = useOverlayState();
  const panelRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // The outer panel is never zoomed, so every measurement (position, clamp,
  // drag, max-height) is in plain CSS pixels. Only the inner content scales.
  useLayoutEffect(() => {
    const element = panelRef.current;
    const inner = innerRef.current;
    if (!element || !inner) return;

    inner.style.zoom = state.scale !== 1 ? String(state.scale) : '';
    inner.style.width = `${Math.min(PANEL_WIDTH, Math.max(240, (window.innerWidth - VIEWPORT_MARGIN * 2) / state.scale))}px`;
    element.style.height = `${Math.max(MIN_HEIGHT, Math.min(680, window.innerHeight - 120))}px`;

    const saved = getPanelPosition();
    if (saved) {
      applyPosition(element, saved, { right: 20, bottom: 82 });
    } else {
      const fab = element.parentElement?.querySelector('.jp-fab') as HTMLElement | null;
      const fabRect = fab?.getBoundingClientRect();
      const height = element.offsetHeight || 0;
      element.style.left = 'auto';
      element.style.top = 'auto';
      element.style.right = fabRect ? `${Math.max(VIEWPORT_MARGIN, window.innerWidth - fabRect.right)}px` : '20px';
      if (fabRect && fabRect.top - 10 - height >= VIEWPORT_MARGIN) element.style.bottom = `${Math.max(VIEWPORT_MARGIN, window.innerHeight - fabRect.top + 10)}px`;
      else if (fabRect) element.style.bottom = `${Math.max(VIEWPORT_MARGIN, window.innerHeight - fabRect.bottom - 10 - height)}px`;
      else element.style.bottom = '82px';
    }

    if (clampToViewport(element) && getPanelPosition()) {
      const rect = element.getBoundingClientRect();
      savePanelPosition({ left: Math.round(rect.left), top: Math.round(rect.top) });
    }
  });

  useEffect(() => {
    const handle = headerRef.current;
    const element = panelRef.current;
    if (!handle || !element) return;
    return makeDraggable(handle, () => element, savePanelPosition);
  }, []);

  useEffect(() => {
    const onResize = () => nudgePositions();
    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(() => nudgePositions());
    const inner = innerRef.current;
    if (inner) observer.observe(inner);
    return () => {
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="jp-panel" ref={panelRef} style={{ fontFamily: OVERLAY_FONT }}>
      <div className="jp-panel-inner" ref={innerRef}>
        <PanelHeader handleRef={headerRef} />
        <Show if={state.view === 'documents'}>
          <DocumentsPage />
        </Show>
        <Show if={state.view !== 'documents'}>
          <MainView />
        </Show>
      </div>
    </div>
  );
}
