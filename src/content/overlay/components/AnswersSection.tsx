import { useOverlayState } from '../store';
import { copyText } from '../actions';
import { AnswerRow } from './AnswerRow';
import { Icon } from './Icon';
import { Show } from '@/ui/components';

export function AnswersSection() {
  const state = useOverlayState();
  const hasAnswers = state.answers.length > 0;

  const renderAnswer = (answer: { question: string; answer: string }, index: number) => (
    <AnswerRow key={`${index}-${answer.question.slice(0, 24)}`} question={answer.question} answer={answer.answer} />
  );

  const copyAll = () => void copyText(state.answers.map((answer) => `${answer.question}\n${answer.answer}`).join('\n\n'), 'All answers copied.');

  return (
    <div className="jp-docs">
      <div className="jp-docs-head">
        <span className="jp-guide-label">
          <Icon name="note" size={13} />
          <span>{`Answers${hasAnswers ? ` (${state.answers.length})` : ''}`}</span>
        </span>
        <Show if={hasAnswers}>
          <button type="button" className="jp-mini" onClick={copyAll}>
            Copy all
          </button>
        </Show>
      </div>
      <Show if={!hasAnswers}>
        <div className="jp-guide-value">
          No written answers yet. They appear here after JobPal answers screening questions - and stay available to copy even if autofill cannot place them.
        </div>
      </Show>
      <Show if={hasAnswers}>{state.answers.map(renderAnswer)}</Show>
    </div>
  );
}
