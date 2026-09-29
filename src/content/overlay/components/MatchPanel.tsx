import { patchOverlay, useOverlayState } from '../store';
import { runAnalyze } from '../actions';
import { recommendationLabel } from '@/ui/constants/match';
import { MiniButton } from './MiniButton';
import { Icon } from './Icon';

export function MatchPanel() {
  const state = useOverlayState();
  const match = state.match;
  const calculateDisabled = state.busy || !state.aiReady || !state.job;

  const renderReason = (reason: string) => <li key={reason}>{reason}</li>;
  const renderMatchedSkill = (skill: string) => (
    <span className="jp-chip" key={skill}>
      {skill}
    </span>
  );
  const renderMissingSkill = (skill: string) => (
    <span className="jp-chip jp-chip--warn" key={skill}>
      {skill}
    </span>
  );

  if (!match) {
    return (
      <div className="jp-match-card">
        <div className="jp-match-empty">
          <span className="jp-match-label">Match score — not calculated yet</span>
          <MiniButton onClick={() => void runAnalyze()} disabled={calculateDisabled} title={state.aiReady ? 'Score this job against your profile' : 'Connect an AI provider first'}>
            Calculate
          </MiniButton>
        </div>
      </div>
    );
  }

  const score = Math.round(match.score);
  const color = score >= 80 ? 'var(--jp-success)' : score >= 65 ? '#b9baff' : score >= 45 ? 'var(--jp-warning)' : 'var(--jp-danger)';
  const reasons = match.reasons.slice(0, 6);
  const matchedSkills = match.matchedSkills.slice(0, 16);
  const missingSkills = match.missingSkills.slice(0, 16);

  return (
    <div className="jp-match-card">
      <button
        type="button"
        className="jp-match-head"
        title={state.matchOpen ? 'Hide match details' : 'Show match details'}
        onClick={() => patchOverlay({ matchOpen: !state.matchOpen })}
      >
        <span className="jp-match-score" style={{ color }}>
          {score}%
        </span>
        <span className="jp-match-label">{recommendationLabel(match.recommendation)}</span>
        <span className="jp-match-chevron" style={{ transform: state.matchOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          <Icon name="chevron" size={13} />
        </span>
      </button>
      {state.matchOpen ? (
        <div className="jp-match-body">
          {reasons.length > 0 ? (
            <ul className="jp-match-reasons">{reasons.map(renderReason)}</ul>
          ) : null}
          {matchedSkills.length > 0 ? (
            <div className="jp-match-group">
              <div className="jp-match-sublabel">Matched skills</div>
              <div className="jp-chips">{matchedSkills.map(renderMatchedSkill)}</div>
            </div>
          ) : null}
          {missingSkills.length > 0 ? (
            <div className="jp-match-group">
              <div className="jp-match-sublabel">Missing from your profile</div>
              <div className="jp-chips">{missingSkills.map(renderMissingSkill)}</div>
            </div>
          ) : null}
          <div className="jp-match-actions">
            <MiniButton onClick={() => void runAnalyze()} disabled={calculateDisabled}>
              Recalculate
            </MiniButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
