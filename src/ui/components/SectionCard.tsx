import type { ReactNode } from 'react';
import { Show } from './Show';

export function SectionCard({ title, hint, action, children }: { title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="row row--between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="panel__title">{title}</div>
          <Show if={Boolean(hint)}>
            <div className="panel__hint">{hint}</div>
          </Show>
        </div>
        <Show if={Boolean(action)}>{action}</Show>
      </div>
      {children}
    </section>
  );
}
