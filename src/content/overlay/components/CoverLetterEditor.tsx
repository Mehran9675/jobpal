export function CoverLetterEditor({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  return (
    <div className="jp-edit-section">
      <label className="jp-field">
        <span className="jp-field-label">Cover letter text</span>
        <textarea
          className="jp-textarea"
          rows={16}
          placeholder="Write your cover letter here…"
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}
