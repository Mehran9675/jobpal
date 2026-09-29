import { useEffect, useState } from 'react';

const COMMA = ',';

function joinItems(items: string[], separator: string): string {
  return items.join(separator === COMMA ? ', ' : '\n');
}

function splitItems(text: string, separator: string): string[] {
  return text
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Text field for a string list (comma separated for skills, one per line for
 * bullets). Keeps the raw text locally so typing a trailing comma or newline
 * is not rewritten while editing; the parent receives the parsed list.
 */
export function ListField({
  label,
  items,
  separator = COMMA,
  rows = 4,
  placeholder,
  onChange,
}: {
  label: string;
  items: string[];
  separator?: string;
  rows?: number;
  placeholder?: string;
  onChange: (items: string[]) => void;
}) {
  const [text, setText] = useState(joinItems(items, separator));
  const normalized = joinItems(items.filter(Boolean), separator);

  useEffect(() => {
    if (joinItems(splitItems(text, separator), separator) !== normalized) setText(joinItems(items, separator));
  }, [normalized]);

  const commit = (value: string) => {
    setText(value);
    onChange(splitItems(value, separator));
  };

  if (rows > 1) {
    return (
      <label className="jp-field">
        <span className="jp-field-label">{label}</span>
        <textarea className="jp-textarea" rows={rows} placeholder={placeholder} value={text} onChange={(event) => commit(event.target.value)} />
      </label>
    );
  }

  return (
    <label className="jp-field">
      <span className="jp-field-label">{label}</span>
      <input className="jp-input" value={text} placeholder={placeholder} onChange={(event) => commit(event.target.value)} />
    </label>
  );
}
