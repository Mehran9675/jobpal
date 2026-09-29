import { useOverlayState } from '../store';
import { Icon } from './Icon';

export function DetectionNotice() {
  const state = useOverlayState();

  const renderIssue = (issue: string) => (
    <li key={issue} className="jp-detect-issue">
      {issue}
    </li>
  );

  return (
    <div className="jp-detect">
      <div className="jp-detect-title">
        <Icon name="alert" size={13} />
        <span>JobPaal could not detect everything on this page</span>
      </div>
      <ul className="jp-detect-list">{state.health.issues.map(renderIssue)}</ul>
      <div className="jp-detect-hint">
        Manual work is needed: use <strong>Guide me</strong> to pick or paste the missing values, then continue.
      </div>
    </div>
  );
}
