import type { TextareaHTMLAttributes } from 'react';

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={['textarea', props.className].filter(Boolean).join(' ')} />;
}
