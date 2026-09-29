import type { ReactNode } from 'react';

export interface FieldProps {
  label?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function Field({ label, hint, error, children, action }: FieldProps) {
  return (
    <div className="field">
      {label ? (
        <label className="field__label">
          <span>{label}</span>
          {action}
        </label>
      ) : null}
      {children}
      {hint ? <div className="field__hint">{hint}</div> : null}
      {error ? <div className="field__error">{error}</div> : null}
    </div>
  );
}
