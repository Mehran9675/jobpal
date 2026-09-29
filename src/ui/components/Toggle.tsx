import type { ReactNode } from 'react';
import { Show } from './Show';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  hint?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, hint, disabled }: ToggleProps) {
  const hasLabel = Boolean(label) || Boolean(hint);
  return (
    <label className="toggle" style={disabled ? { opacity: 0.55 } : undefined}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      <span className="toggle__track">
        <span className="toggle__thumb" />
      </span>
      <Show if={hasLabel}>
        <span>
          <Show if={Boolean(label)}>
            <span className="toggle__label">{label}</span>
          </Show>
          <Show if={Boolean(hint)}>
            <div className="tiny muted" style={{ marginTop: 1 }}>
              {hint}
            </div>
          </Show>
        </span>
      </Show>
    </label>
  );
}
