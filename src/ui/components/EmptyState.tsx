import type { ReactNode } from 'react';
import { Show } from './Show';

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Show if={Boolean(icon)}>
        <div className="empty__icon">{icon}</div>
      </Show>
      <div className="empty__title">{title}</div>
      <Show if={Boolean(text)}>
        <p className="empty__text">{text}</p>
      </Show>
      <Show if={Boolean(action)}>{action}</Show>
    </div>
  );
}
