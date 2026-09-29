import { Button, SectionCard } from '@/ui/components';

export function AiNotice({ reason, onConnect }: { reason?: string; onConnect: () => void }) {
  return (
    <SectionCard title="AI not connected">
      <div className="small muted mb-2">{reason ?? 'Connect a provider to enable tailoring and match scoring.'} Autofill works without AI.</div>
      <Button size="sm" variant="primary" onClick={onConnect}>
        Connect AI
      </Button>
    </SectionCard>
  );
}
