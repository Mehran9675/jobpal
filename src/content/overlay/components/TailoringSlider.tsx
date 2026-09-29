import { useOverlayState } from '../store';
import { setFaithfulness } from '../actions';
import { Icon } from './Icon';

export function TailoringSlider() {
  const state = useOverlayState();
  const label = state.faithfulness >= 70 ? 'Exact' : state.faithfulness >= 40 ? 'Balanced' : 'Reworded';

  return (
    <div className="jp-slider">
      <div className="jp-slider-head">
        <span className="jp-guide-label">
          <Icon name="shield" size={13} />
          <span>Resume wording</span>
        </span>
        <span className="jp-slider-value">{label}</span>
      </div>
      <input
        className="jp-range"
        type="range"
        min={0}
        max={100}
        step={5}
        value={state.faithfulness}
        onChange={(event) => void setFaithfulness(Number(event.target.value))}
      />
      <div className="jp-slider-ends">
        <span>Reworded</span>
        <span>Exact</span>
      </div>
      <div className="jp-guide-hint">
        JobPal never adds experience, skills or seniority you did not report. Left reworks your headline, summary and descriptions to match the job; right keeps your own wording.
      </div>
    </div>
  );
}
