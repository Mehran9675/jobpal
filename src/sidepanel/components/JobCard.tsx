import type { PageContext } from '@/types';
import { Badge, SectionCard, Show, type MatchCardData } from '@/ui/components';
import { MatchBlock } from './MatchBlock';
import { JobActions } from './JobActions';
import { BusyBlock } from './BusyBlock';

export function JobCard({
  context,
  title,
  company,
  match,
  matchOpen,
  onToggleMatch,
  onRecalculate,
  canRecalculate,
  busyLabel,
  progressText,
  onStop,
  onTailor,
  onGuide,
  onPaste,
  aiReady,
}: {
  context: PageContext | null;
  title: string;
  company: string;
  match: MatchCardData | null;
  matchOpen: boolean;
  onToggleMatch: () => void;
  onRecalculate: () => void;
  canRecalculate: boolean;
  busyLabel: string | null;
  progressText: string;
  onStop: () => void;
  onTailor: () => void;
  onGuide: () => void;
  onPaste: () => void;
  aiReady: boolean;
}) {
  return (
    <SectionCard title={title} hint={company}>
      <Show if={Boolean(context?.hasApplicationForm)}>
        <Badge tone="info">Application form detected</Badge>
      </Show>
      <MatchBlock match={match} open={matchOpen} onToggle={onToggleMatch} onRecalculate={onRecalculate} canRecalculate={canRecalculate} busy={busyLabel === 'match'} />
      <JobActions
        hasJob={Boolean(context?.hasJob)}
        aiReady={aiReady}
        busy={Boolean(busyLabel)}
        tailoring={busyLabel === 'tailor'}
        onTailor={onTailor}
        onGuide={onGuide}
        onPaste={onPaste}
      />
      <Show if={Boolean(busyLabel)}>
        <BusyBlock progressText={progressText} onStop={onStop} />
      </Show>
    </SectionCard>
  );
}
