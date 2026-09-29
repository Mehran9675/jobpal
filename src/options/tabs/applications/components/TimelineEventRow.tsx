import type { TimelineEvent } from '@/types';
import { Show } from '@/ui/components';

export function TimelineEventRow({ event }: { event: TimelineEvent }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <span className="tiny muted nowrap" style={{ width: 150 }}>
        {new Date(event.at).toLocaleString()}
      </span>
      <div>
        <div className="small strong">{event.label}</div>
        <Show if={Boolean(event.note)}>
          <div className="tiny muted">{event.note}</div>
        </Show>
      </div>
    </div>
  );
}
