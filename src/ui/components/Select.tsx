import type { SelectHTMLAttributes } from 'react';

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={['select', props.className].filter(Boolean).join(' ')} />;
}
