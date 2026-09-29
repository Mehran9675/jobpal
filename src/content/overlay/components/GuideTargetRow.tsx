import { useOverlayState } from '../store';
import { runPick } from '../actions';
import type { GuideTarget } from '../constants';
import { MiniButton } from './MiniButton';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export function GuideTargetRow({ target, label, icon }: { target: GuideTarget; label: string; icon: IconName }) {
  const state = useOverlayState();
  const picked = state.picks[target];

  return (
    <div className="jp-guide-row">
      <div className="jp-guide-info">
        <div className="jp-guide-label">
          <Icon name={icon} size={13} />
          <span>{label}</span>
        </div>
        <div className="jp-guide-value">{picked ? picked.value.slice(0, 90) || '(empty element)' : 'Not set'}</div>
      </div>
      <MiniButton onClick={() => void runPick(target)} disabled={state.picking || state.busy}>
        {picked ? 'Re-pick' : 'Pick'}
      </MiniButton>
    </div>
  );
}
