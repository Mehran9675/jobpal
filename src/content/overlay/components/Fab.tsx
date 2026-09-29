import { useEffect, useLayoutEffect, useRef } from 'react';
import { applyPosition, clampToViewport, makeDraggable } from '../dom';
import { getFabPosition, patchOverlay, saveFabPosition, useOverlayState } from '../store';
import { refreshContext } from '../actions';
import { Show } from '@/ui/components';
import { Icon } from './Icon';

export function Fab() {
  const state = useOverlayState();
  const ref = useRef<HTMLButtonElement>(null);
  const title = state.health.ok ? 'JobPal - drag to move' : `JobPal: ${state.health.issues[0] ?? 'detection issues'} - click for details`;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    applyPosition(element, getFabPosition(), { right: 20, bottom: 20 });
    if (getFabPosition() && clampToViewport(element)) {
      const rect = element.getBoundingClientRect();
      saveFabPosition({ left: Math.round(rect.left), top: Math.round(rect.top) });
    }
  }, [state.positionVersion]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return makeDraggable(element, () => element, saveFabPosition);
  }, []);

  return (
    <button
      type="button"
      ref={ref}
      className={`jp-fab ${state.health.ok ? 'jp-fab-ok' : 'jp-fab-bad'}`}
      title={title}
      onClick={() => {
        const next = !state.panelOpen;
        patchOverlay({ panelOpen: next });
        if (next) void refreshContext();
      }}
    >
      <Show if={state.panelOpen}>×</Show>
      <Show if={!state.panelOpen}>
        <Icon name="logo" size={22} />
      </Show>
    </button>
  );
}
