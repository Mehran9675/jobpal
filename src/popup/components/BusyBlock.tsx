import { Button, Progress, Show } from '@/ui/components';

export function BusyBlock({ progressText, onStop }: { progressText: string; onStop: () => void }) {
  return (
    <>
      <div className="jp-busy-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Progress indeterminate />
        </div>
        <Button size="sm" variant="danger" onClick={onStop}>
          Stop
        </Button>
      </div>
      <Show if={Boolean(progressText)}>
        <div className="tiny muted">{progressText}</div>
      </Show>
    </>
  );
}
