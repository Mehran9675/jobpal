import type { PageContext } from '@/types';
import { Badge } from '@/ui/components';
import { IconBriefcase } from '@/ui/components/Icons';
import type { ContextAction } from './ContextActions';
import { ContextActions } from './ContextActions';
import type { MatchCardData } from '@/ui/components';
import { MatchCard } from '@/ui/components';

export function ContextCard({
  context,
  title,
  meta,
  actions,
  match,
  matchOpen,
  onToggleMatch,
  onRecalculate,
  calculating,
}: {
  context: PageContext | null;
  title: string;
  meta: string;
  actions: ContextAction[];
  match: MatchCardData | null;
  matchOpen: boolean;
  onToggleMatch: () => void;
  onRecalculate?: () => void;
  calculating: boolean;
}) {
  const siteLabel =
    context?.site === 'linkedin-profile' ? 'LinkedIn profile' : context?.site && context.site !== 'other' ? context.site : 'No job detected';

  return (
    <div className="context-card">
      <div className="context-card__site">
        <IconBriefcase size={14} />
        <Badge tone={context?.site && context.site !== 'other' ? 'primary' : 'neutral'}>{siteLabel}</Badge>
        {context?.hasApplicationForm ? <Badge tone="info">Form ready</Badge> : null}
      </div>
      <div className="context-card__title">{title}</div>
      <div className="context-card__meta">{meta}</div>
      <ContextActions actions={actions} />
      <div className="mt-2">
        <MatchCard match={match} open={matchOpen} onToggle={onToggleMatch} onRecalculate={onRecalculate} busy={calculating} />
      </div>
    </div>
  );
}
