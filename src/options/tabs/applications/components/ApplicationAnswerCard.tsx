import type { AnswerRecord } from '@/types';
import { Button } from '@/ui/components';

export function ApplicationAnswerCard({ answer, onCopy }: { answer: AnswerRecord; onCopy: (answer: AnswerRecord) => void }) {
  return (
    <div className="card card--flat">
      <div className="row row--between mb-1">
        <div className="strong">{answer.question}</div>
        <Button size="sm" variant="ghost" onClick={() => onCopy(answer)}>
          Copy
        </Button>
      </div>
      <div className="small" style={{ whiteSpace: 'pre-wrap' }}>
        {answer.answer}
      </div>
    </div>
  );
}
