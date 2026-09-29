import type { ReactNode } from 'react';

export function StatusMessage({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warn' | 'error'; children: ReactNode }) {
  return <div className={`jp-status ${tone === 'info' ? '' : tone}`.trim()}>{children}</div>;
}
