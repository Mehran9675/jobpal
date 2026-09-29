import { useOverlayState } from '../store';
import { removeManualEntry, runPickAnswer } from '../actions';
import { MiniButton } from './MiniButton';

export function ManualEntryList() {
  const state = useOverlayState();

  const renderEntry = (entry: { id: string; question: string; answer: string }) => (
    <div className="jp-guide-row" key={entry.id}>
      <div className="jp-guide-info">
        <div className="jp-guide-label">{entry.question}</div>
        <div className="jp-guide-value">{entry.answer.slice(0, 90)}</div>
      </div>
      <div className="jp-guide-actions">
        <MiniButton title="Click the field on the page and fill it with this answer" onClick={() => void runPickAnswer(entry.question, entry.answer)} disabled={state.picking || state.busy}>
          Send
        </MiniButton>
        <MiniButton title="Remove this saved answer" onClick={() => void removeManualEntry(entry.id)}>
          Remove
        </MiniButton>
      </div>
    </div>
  );

  return <div className="jp-bank">{state.bank.map(renderEntry)}</div>;
}
