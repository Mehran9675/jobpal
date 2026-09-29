import { copyText, runPickAnswer } from '../actions';
import { MiniButton } from './MiniButton';

export function AnswerRow({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="jp-answer">
      <div className="jp-answer-info">
        <div className="jp-answer-q">{question.slice(0, 140)}</div>
        <div className="jp-guide-value">{answer.slice(0, 200)}</div>
      </div>
      <div className="jp-doc-actions">
        <MiniButton title="Choose the field on the page where this answer goes" onClick={() => void runPickAnswer(question, answer)}>
          Send to field
        </MiniButton>
        <MiniButton onClick={() => void copyText(answer, 'Answer copied.')}>Copy</MiniButton>
      </div>
    </div>
  );
}
