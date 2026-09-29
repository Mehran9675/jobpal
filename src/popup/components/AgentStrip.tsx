import { Button } from '@/ui/components';
import { IconPlay } from '@/ui/components/Icons';

export function AgentStrip({
  running,
  paused,
  queued,
  appliedToday,
  onStart,
  onPause,
  onResume,
  startDisabled,
}: {
  running: boolean;
  paused: boolean;
  queued: number;
  appliedToday: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  startDisabled: boolean;
}) {
  const statusLabel = running ? (paused ? 'Agent paused' : 'Agent running') : 'Agent idle';

  return (
    <div className="agent-strip">
      <div className="row">
        <span className={`agent-strip__dot ${running ? (paused ? 'paused' : 'running') : ''}`} />
        <div>
          <div className="small strong">{statusLabel}</div>
          <div className="tiny muted">{`${queued} queued · ${appliedToday} applied today`}</div>
        </div>
      </div>
      {running ? (
        <Button size="sm" variant={paused ? 'primary' : 'outline'} onClick={paused ? onResume : onPause}>
          {paused ? 'Resume' : 'Pause'}
        </Button>
      ) : (
        <Button size="sm" variant="primary" icon={<IconPlay size={13} />} disabled={startDisabled} title={startDisabled ? 'Connect an AI provider first' : 'Start the agent'} onClick={onStart}>
          Start
        </Button>
      )}
    </div>
  );
}
