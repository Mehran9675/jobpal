import { useState } from 'react';
import { useOverlayState } from '../store';
import { askAiForAnswer, runPickAnswer, saveManualEntry } from '../actions';
import { MiniButton } from './MiniButton';

export function ManualEntryWriter() {
  const state = useOverlayState();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  const ready = Boolean(question.trim() && answer.trim());
  const canWrite = ready && !state.picking && !state.busy;
  const canAsk = Boolean(question.trim()) && state.aiReady && !busy && !state.busy;

  const ask = async () => {
    setBusy(true);
    const drafted = await askAiForAnswer(question.trim());
    setBusy(false);
    if (drafted) setAnswer(drafted);
  };

  return (
    <div className="jp-manual">
      <label className="jp-field">
        <span className="jp-field-label">Question or field JobPaal missed</span>
        <input
          className="jp-input"
          value={question}
          placeholder="e.g. Why do you want to work here?"
          onChange={(event) => setQuestion(event.target.value)}
        />
      </label>
      <label className="jp-field">
        <span className="jp-field-label">Answer or value</span>
        <textarea
          className="jp-textarea"
          rows={3}
          placeholder="Type your answer, or draft one with AI"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
        />
      </label>
      <div className="jp-match-actions">
        <MiniButton icon="sparkles" title="Draft an answer with your AI provider" onClick={() => void ask()} disabled={!canAsk}>
          {busy ? 'Drafting…' : 'Ask AI'}
        </MiniButton>
        <MiniButton
          icon="clipboard"
          title="Save this question and answer - matching fields are filled on every form"
          onClick={() => void saveManualEntry(question.trim(), answer.trim())}
          disabled={!canWrite}
        >
          Save for reuse
        </MiniButton>
        <MiniButton
          icon="target"
          title="Click the field on the page and fill it with this answer now"
          onClick={() => void runPickAnswer(question.trim(), answer.trim())}
          disabled={!canWrite}
        >
          Send to field
        </MiniButton>
      </div>
    </div>
  );
}
