import { useState } from 'react';
import { useOverlayState } from '../store';
import { runPick } from '../actions';
import type { GuideTarget } from '../constants';
import { MiniButton } from './MiniButton';
import { GuidePasteField } from './GuidePasteField';
import { Icon } from './Icon';
import { Show } from '@/ui/components';
import type { IconName } from './Icon';

export function GuideTargetRow({ target, label, icon }: { target: GuideTarget; label: string; icon: IconName }) {
  const state = useOverlayState();
  const [pasteOpen, setPasteOpen] = useState(false);
  const picked = state.picks[target];
  const pasted = state.pastedFields[target] ?? '';
  const value = picked?.value || pasted;
  const source = picked ? 'picked' : pasted ? 'pasted' : '';

  return (
    <div className="jp-guide-item">
      <div className="jp-guide-row">
        <div className="jp-guide-info">
          <div className="jp-guide-label">
            <Icon name={icon} size={13} />
            <span>{label}</span>
          </div>
          <div className="jp-guide-value">{value ? `${value.slice(0, 90)}${value.length > 90 ? '…' : ''}` : 'Not set'}</div>
        </div>
        <div className="jp-guide-actions">
          <MiniButton onClick={() => void runPick(target)} disabled={state.picking || state.busy}>
            {source === 'picked' ? 'Re-pick' : 'Pick'}
          </MiniButton>
          <MiniButton onClick={() => setPasteOpen(!pasteOpen)}>{source === 'pasted' ? 'Edit' : 'Paste'}</MiniButton>
        </div>
      </div>
      <Show if={pasteOpen}>
        <GuidePasteField target={target} label={label} />
      </Show>
    </div>
  );
}
