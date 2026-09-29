import { MatchCard, type MatchCardData } from '@/ui/components';

export function MatchBlock({
  match,
  open,
  onToggle,
  onRecalculate,
  canRecalculate,
  busy,
}: {
  match: MatchCardData | null;
  open: boolean;
  onToggle: () => void;
  onRecalculate: () => void;
  canRecalculate: boolean;
  busy: boolean;
}) {
  return (
    <div className="mt-2">
      <MatchCard match={match} open={open} onToggle={onToggle} onRecalculate={canRecalculate ? onRecalculate : undefined} busy={busy} />
    </div>
  );
}
