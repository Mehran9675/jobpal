import type { ApplicationRecord } from '@/types';
import { Button, SectionCard } from '@/ui/components';
import { AnswerRow } from './AnswerRow';

export function AnswersCard({
  application,
  onCopyAll,
  onCopyAnswer,
}: {
  application: ApplicationRecord;
  onCopyAll: () => void;
  onCopyAnswer: (answer: string) => void;
}) {
  const renderAnswer = (answer: { question: string; answer: string }, index: number) => (
    <AnswerRow key={`${index}-${answer.question.slice(0, 24)}`} question={answer.question} answer={answer.answer} onCopy={onCopyAnswer} />
  );

  return (
    <SectionCard
      title="Written answers"
      action={
        <div className="row">
          <Button size="sm" variant="ghost" onClick={onCopyAll}>
            Copy all
          </Button>
        </div>
      }
    >
      <div className="list">{application.answers.map(renderAnswer)}</div>
    </SectionCard>
  );
}
