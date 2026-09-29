import { stopGeneration } from '../actions';
import { MiniButton } from './MiniButton';

export function BusyRow() {
  return (
    <div className="jp-busy-row">
      <div className="jp-progress active">
        <div className="jp-progress-bar" />
      </div>
      <MiniButton className="jp-mini-danger" onClick={() => void stopGeneration()}>
        Stop
      </MiniButton>
    </div>
  );
}
