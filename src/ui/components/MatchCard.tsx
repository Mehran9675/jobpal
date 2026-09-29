import { recommendationLabel } from '../constants/match';
import { Button } from './Button';
import { Show } from './Show';

export interface MatchCardData {
  score: number;
  reasons?: string[];
  matchedSkills?: string[];
  missingSkills?: string[];
  recommendation?: string;
}

export function MatchCard({
  match,
  open,
  onToggle,
  onRecalculate,
  busy,
  calculateLabel = 'Calculate match',
}: {
  match: MatchCardData | null;
  open: boolean;
  onToggle: () => void;
  onRecalculate?: () => void;
  busy?: boolean;
  calculateLabel?: string;
}) {
  const renderReason = (reason: string) => <li key={reason}>{reason}</li>;
  const renderMatchedSkill = (skill: string) => (
    <span className="chip" key={skill} style={{ borderColor: 'color-mix(in srgb, var(--success) 45%, transparent)' }}>
      {skill}
    </span>
  );
  const renderMissingSkill = (skill: string) => (
    <span className="chip" key={skill} style={{ borderColor: 'color-mix(in srgb, var(--warning) 45%, transparent)' }}>
      {skill}
    </span>
  );

  if (!match) {
    return (
      <div className="match-card match-card--empty">
        <div className="match-card__placeholder">
          <span className="muted small">No match score yet.</span>
          <Show if={Boolean(onRecalculate)}>
            <Button size="sm" variant="outline" loading={busy} onClick={onRecalculate}>
              {calculateLabel}
            </Button>
          </Show>
        </div>
      </div>
    );
  }

  const score = Math.round(match.score);
  const color = score >= 80 ? 'var(--success)' : score >= 65 ? 'var(--accent)' : score >= 45 ? 'var(--warning)' : 'var(--danger)';
  const reasons = match.reasons ?? [];
  const matchedSkills = (match.matchedSkills ?? []).slice(0, 18);
  const missingSkills = (match.missingSkills ?? []).slice(0, 18);

  return (
    <div className="match-card">
      <button className="match-card__head" onClick={onToggle} aria-expanded={open}>
        <span className="match-card__score" style={{ color }}>
          {score}%
        </span>
        <span className="match-card__label">
          {recommendationLabel(match.recommendation)}
          <span className="tiny muted"> · tap for details</span>
        </span>
        <span className="match-card__chevron">{open ? '▾' : '▸'}</span>
      </button>
      <Show if={open}>
        <div className="match-card__body">
          <Show if={reasons.length > 0}>
            <ul className="match-card__reasons">{reasons.map(renderReason)}</ul>
          </Show>
          <Show if={matchedSkills.length > 0}>
            <div className="match-card__group">
              <div className="tiny muted mb-1">Matched skills</div>
              <div className="chips">{matchedSkills.map(renderMatchedSkill)}</div>
            </div>
          </Show>
          <Show if={missingSkills.length > 0}>
            <div className="match-card__group">
              <div className="tiny muted mb-1">Missing from your profile</div>
              <div className="chips">{missingSkills.map(renderMissingSkill)}</div>
            </div>
          </Show>
          <Show if={Boolean(onRecalculate)}>
            <div className="row mt-2">
              <Button size="sm" variant="outline" loading={busy} onClick={onRecalculate}>
                Recalculate
              </Button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
