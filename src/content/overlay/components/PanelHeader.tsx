import type { RefObject } from 'react';
import { patchOverlay, useOverlayState } from '../store';
import { setShowOverlay } from '../actions';
import { Icon } from './Icon';
import { SizeControls } from './SizeControls';

export function PanelHeader({ handleRef }: { handleRef: RefObject<HTMLDivElement> }) {
  const state = useOverlayState();

  return (
    <div className="jp-header" ref={handleRef}>
      <div className="jp-brand">
        <span className="jp-logo">
          <Icon name="logo" size={14} />
        </span>
        <span>JobPal</span>
      </div>
      <div className="jp-header-right">
        <button
          type="button"
          className="jp-switch"
          role="switch"
          aria-checked={state.showOverlay}
          title="Hide the overlay. Turn it back on from the JobPal popup."
          onClick={() => void setShowOverlay(!state.showOverlay)}
        >
          <span className="jp-switch-track">
            <span className="jp-switch-thumb" />
          </span>
        </button>
        <SizeControls />
        <span className="jp-drag-hint" title="Drag to move">
          <Icon name="grip" size={13} />
        </span>
        <button type="button" className="jp-close" onClick={() => patchOverlay({ panelOpen: false })}>
          ×
        </button>
      </div>
    </div>
  );
}
