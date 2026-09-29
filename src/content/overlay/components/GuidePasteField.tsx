import { useEffect, useState } from 'react';
import { useOverlayState } from '../store';
import { runPasteField } from '../actions';
import type { GuideTarget } from '../constants';
import { MiniButton } from './MiniButton';

export function GuidePasteField({ target, label }: { target: GuideTarget; label: string }) {
  const state = useOverlayState();
  const current = state.pastedFields[target] ?? '';
  const [draft, setDraft] = useState(current);
  const noun = label.toLowerCase();
  const rows = target === 'description' ? 4 : 2;

  useEffect(() => {
    setDraft(current);
  }, [current]);

  return (
    <div className="jp-guide-paste">
      <textarea
        className="jp-textarea"
        rows={rows}
        placeholder={`Paste the ${noun} here…`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="jp-match-actions">
        <MiniButton onClick={() => void runPasteField(target, draft)}>Use this {noun}</MiniButton>
        <MiniButton
          onClick={() => {
            setDraft('');
            void runPasteField(target, '');
          }}
        >
          Clear
        </MiniButton>
      </div>
    </div>
  );
}
