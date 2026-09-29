import type { AgentState } from '@/types';
import { Badge, Button, SectionCard, Show } from '@/ui/components';
import { AgentLog } from './AgentLog';

export function AgentCard({ agent, onConfigure }: { agent: AgentState | undefined; onConfigure: () => void }) {
  const running = Boolean(agent?.running);
  const paused = Boolean(agent?.paused);
  const statusLabel = running ? (paused ? 'Paused' : 'Running') : 'Idle';
  const hasLog = (agent?.log ?? []).length > 0;

  return (
    <SectionCard title="Agent" action={<Button size="sm" variant="ghost" onClick={onConfigure}>Configure</Button>}>
      <div className="row row--between">
        <div className="row">
          <span className={`agent-strip__dot ${running ? (paused ? 'paused' : 'running') : ''}`} />
          <div>
            <div className="small strong">{statusLabel}</div>
            <div className="tiny muted">
              {agent ? `${agent.queue.filter((item) => item.status === 'queued').length} queued · ${agent.appliedToday} today` : ''}
            </div>
          </div>
        </div>
        <Show if={running && Boolean(agent?.currentItem)}>
          <Badge tone="primary">{agent?.currentItem?.title.slice(0, 24)}</Badge>
        </Show>
      </div>
      <Show if={hasLog}>
        <AgentLog log={agent?.log ?? []} />
      </Show>
    </SectionCard>
  );
}
