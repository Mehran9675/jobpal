import { useEffect, useLayoutEffect, useRef } from 'react';
import { applyPosition, clampToViewport, makeDraggable } from '../dom';
import { getPanelPosition, OVERLAY_FONT, savePanelPosition, useOverlayState } from '../store';
import { PanelHeader } from './PanelHeader';
import { MainView } from './MainView';
import { DocumentsPage } from './DocumentsPage';
import { Show } from '@/ui/components';

export function Panel() {
  const state = useOverlayState();
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = panelRef.current;
    if (!element) return;
    element.style.zoom = state.scale !== 1 ? String(state.scale) : '';
    const saved = getPanelPosition();
    if (saved) {
      applyPosition(element, saved, { right: 20, bottom: 82 });
    } else {
      const fab = element.parentElement?.querySelector('.jp-fab') as HTMLElement | null;
      const fabRect = fab?.getBoundingClientRect();
      const height = element.offsetHeight || 0;
      element.style.left = 'auto';
      element.style.top = 'auto';
      element.style.right = fabRect ? `${Math.max(8, window.innerWidth - fabRect.right)}px` : '20px';
      if (fabRect && fabRect.top - 10 - height >= 8) element.style.bottom = `${Math.max(8, window.innerHeight - fabRect.top + 10)}px`;
      else if (fabRect) element.style.bottom = `${Math.max(8, window.innerHeight - fabRect.bottom - 10 - height)}px`;
      else element.style.bottom = '82px';
    }
    const rect = element.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (rect.right > window.innerWidth - 8) dx = window.innerWidth - 8 - rect.right;
    if (rect.left + dx < 8) dx = 8 - rect.left;
    if (rect.bottom > window.innerHeight - 8) dy = window.innerHeight - 8 - rect.bottom;
    if (rect.top + dy < 8) dy = 8 - rect.top;
    if (dx !== 0 || dy !== 0) {
      const position = { left: Math.round(rect.left + dx), top: Math.round(rect.top + dy) };
      savePanelPosition(position);
      applyPosition(element, position, { right: 20, bottom: 82 });
    }
  });

  useEffect(() => {
    const handle = headerRef.current;
    const element = panelRef.current;
    if (!handle || !element) return;
    return makeDraggable(handle, () => element, savePanelPosition);
  }, []);

  return (
    <div className="jp-panel" ref={panelRef} style={{ fontFamily: OVERLAY_FONT }}>
      <PanelHeader handleRef={headerRef} />
      <Show if={state.view === 'documents'}>
        <DocumentsPage />
      </Show>
      <Show if={state.view !== 'documents'}>
        <MainView />
      </Show>
    </div>
  );
}
