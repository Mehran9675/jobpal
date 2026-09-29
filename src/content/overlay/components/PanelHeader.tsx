import type { RefObject } from 'react';
import { patchOverlay } from '../store';
import { Icon } from './Icon';
import { SizeControls } from './SizeControls';

export function PanelHeader({ handleRef }: { handleRef: RefObject<HTMLDivElement> }) {
  return (
    <div className="jp-header" ref={handleRef}>
      <div className="jp-brand">
        <span className="jp-logo">
          <Icon name="logo" size={14} />
        </span>
        <span>JobPal</span>
      </div>
      <div className="jp-header-right">
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
