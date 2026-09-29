import { Button, Progress, Show } from '@/ui/components';

export function BusyBlock({ progressText, onStop }: { progressText: string; onStop: () => void }) {
  return (
    <div className="mt-2">
      <div className="row" style={{ gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Progress indeterminate />
        </div>
        <Button size="sm" variant="danger" onClick={onStop}>
          Stop
        </Button>
      </div>
      <Show if={Boolean(progressText)}>
        <div className="tiny muted mt-1">{progressText}</div>
      </Show>
    </div>
  );
}
