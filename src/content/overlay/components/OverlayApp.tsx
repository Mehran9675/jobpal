import { useEffect, useRef } from 'react';
import { getOverlayState, OVERLAY_FONT, useOverlayState } from '../store';
import { closeAllMenus } from '../actions';
import { Fab } from './Fab';
import { Panel } from './Panel';
import { Show } from '@/ui/components';

export function OverlayApp() {
  const state = useOverlayState();
  const rootRef = useRef<HTMLDivElement>(null);

  // One persistent listener closes any open document menu on outside clicks.
  useEffect(() => {
    const node = rootRef.current?.getRootNode();
    if (!(node instanceof ShadowRoot)) return;
    const handler = (event: Event) => {
      if (!getOverlayState().openDocMenu) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.closest('[data-menu-toggle]') || target.closest('.jp-doc-menu'))) return;
      closeAllMenus();
    };
    node.addEventListener('click', handler, true);
    return () => node.removeEventListener('click', handler, true);
  }, []);

  return (
    <div className="jp-root" ref={rootRef} style={{ fontFamily: OVERLAY_FONT }}>
      <Fab />
      <Show if={state.panelOpen}>
        <Panel />
      </Show>
    </div>
  );
}
