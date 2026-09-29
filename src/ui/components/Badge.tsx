import type { ReactNode } from 'react';

export interface BadgeProps {
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return <span className={['badge', tone !== 'neutral' && `badge--${tone}`, className].filter(Boolean).join(' ')}>{children}</span>;
}
