import { Button } from '@/ui/components';
import { IconCpu } from '@/ui/components/Icons';

export function AiNotice({ reason, onConnect }: { reason?: string; onConnect: () => void }) {
  return (
    <div className="context-card" style={{ borderColor: 'var(--warning)' }}>
      <div className="context-card__site" style={{ marginBottom: 4 }}>
        <span className="badge badge--warning">AI not connected</span>
      </div>
      <div className="context-card__meta">{reason ?? 'Connect a provider to enable tailoring.'} Autofill still works without AI.</div>
      <div className="context-card__actions">
        <Button size="sm" variant="primary" icon={<IconCpu size={14} />} onClick={onConnect}>
          Connect AI
        </Button>
      </div>
    </div>
  );
}
