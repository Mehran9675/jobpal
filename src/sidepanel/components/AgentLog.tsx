import type { AgentState } from '@/types';

const LOG_LIMIT = 5;

export function AgentLog({ log }: { log: AgentState['log'] }) {
  const visible = log.slice(0, LOG_LIMIT);

  const renderEntry = (entry: AgentState['log'][number], index: number) => (
    <div key={`${index}-${entry.at}`} className={`log-view__row log-view__row--${entry.level}`}>
      <span className="log-view__time">{new Date(entry.at).toLocaleTimeString()}</span>
      <span>{entry.message}</span>
    </div>
  );

  return (
    <div className="log-view mt-2" style={{ maxHeight: 140 }}>
      {visible.map(renderEntry)}
    </div>
  );
}
