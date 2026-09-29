import { useEffect, useState } from 'react';
import { useOverlayState } from '../store';
import { runPasteDescription } from '../actions';
import { MiniButton } from './MiniButton';
import { Icon } from './Icon';

export function GuidePasteBox() {
  const state = useOverlayState();
  const [draft, setDraft] = useState(state.pastedText);

  useEffect(() => {
    setDraft(state.pastedText);
  }, [state.pastedText]);

  return (
    <div className="jp-guide-paste">
      <div className="jp-guide-label">
        <Icon name="clipboard" size={13} />
        <span>Or paste the job description</span>
      </div>
      <div className="jp-guide-hint">
        Use this when a posting has no readable description (for example “email your resume to…” pages). It is used exactly like a scraped description.
      </div>
      <textarea
        className="jp-textarea"
        rows={4}
        placeholder="Paste the full job description here…"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="jp-match-actions">
        <MiniButton onClick={() => void runPasteDescription(draft)}>Use this description</MiniButton>
        <MiniButton
          onClick={() => {
            setDraft('');
            void runPasteDescription('');
          }}
        >
          Clear
        </MiniButton>
      </div>
    </div>
  );
}
