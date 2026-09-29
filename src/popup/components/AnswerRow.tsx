import { Button } from '@/ui/components';

export function AnswerRow({ question, answer, onCopy }: { question: string; answer: string; onCopy: (answer: string) => void }) {
  return (
    <div className="list-item">
      <div className="list-item__main">
        <div className="list-item__title">{question}</div>
        <div className="list-item__meta">{answer.slice(0, 110)}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={() => onCopy(answer)}>
        Copy
      </Button>
    </div>
  );
}
