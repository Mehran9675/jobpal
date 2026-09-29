import { withListEntry } from '../helpers/editorContent';

export function AnswersEditor({
  answers,
  onChange,
}: {
  answers: { question: string; answer: string }[];
  onChange: (answers: { question: string; answer: string }[]) => void;
}) {
  const renderAnswer = (entry: { question: string; answer: string }, index: number) => (
    <div className="jp-edit-section" key={`${index}-${entry.question}`}>
      <div className="jp-guide-label">{entry.question || `Question ${index + 1}`}</div>
      <textarea
        className="jp-textarea"
        rows={4}
        placeholder="Answer…"
        value={entry.answer}
        onChange={(event) => onChange(withListEntry(answers, index, { answer: event.target.value }))}
      />
    </div>
  );

  return <div className="jp-edit-stack">{answers.map(renderAnswer)}</div>;
}
