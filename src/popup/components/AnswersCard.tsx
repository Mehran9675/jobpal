import type { ApplicationRecord } from '@/types';
import { Button } from '@/ui/components';
import { IconNote } from '@/ui/components/Icons';
import { AnswerRow } from './AnswerRow';

const MAX_VISIBLE_ANSWERS = 2;

export function AnswersCard({
  application,
  onCopyAll,
  onCopyAnswer,
  onView,
}: {
  application: ApplicationRecord;
  onCopyAll: () => void;
  onCopyAnswer: (answer: string) => void;
  onView: () => void;
}) {
  const visible = application.answers.slice(0, MAX_VISIBLE_ANSWERS);

  const renderAnswer = (answer: { question: string; answer: string }, index: number) => (
    <AnswerRow key={`${index}-${answer.question.slice(0, 24)}`} question={answer.question} answer={answer.answer} onCopy={onCopyAnswer} />
  );

  return (
    <div className="card card--flat">
      <div className="card__header">
        <div className="card__title">
          <IconNote size={14} /> Written answers
        </div>
        <div className="row">
          <Button size="sm" variant="ghost" onClick={onCopyAll}>
            Copy all
          </Button>
          <Button size="sm" variant="ghost" onClick={onView}>
            View
          </Button>
        </div>
      </div>
      <div className="list">{visible.map(renderAnswer)}</div>
    </div>
  );
}
