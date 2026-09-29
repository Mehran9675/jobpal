import { patchOverlay, SCALE_MAX, SCALE_MIN, SCALE_STEP, setOverlayScale, useOverlayState } from '../store';

export function SizeControls() {
  const state = useOverlayState();
  return (
    <div className="jp-size-controls">
      <button
        type="button"
        className="jp-size-btn"
        title="Decrease size"
        disabled={state.scale <= SCALE_MIN}
        onClick={() => setOverlayScale(state.scale - SCALE_STEP)}
      >
        A-
      </button>
      <button
        type="button"
        className="jp-size-btn"
        title="Increase size"
        disabled={state.scale >= SCALE_MAX}
        onClick={() => setOverlayScale(state.scale + SCALE_STEP)}
      >
        A+
      </button>
    </div>
  );
}
