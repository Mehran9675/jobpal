import type { ReactNode } from 'react';
import { IconX } from './icon-set';
import { Button } from './Button';
import { Show } from './Show';

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={['modal', wide ? 'modal--wide' : ''].filter(Boolean).join(' ')}>
        <div className="modal__header">
          <div>
            <div className="modal__title">{title}</div>
            <Show if={Boolean(subtitle)}>
              <div className="modal__subtitle">{subtitle}</div>
            </Show>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" icon={<IconX size={14} />} />
        </div>
        {children}
        <Show if={Boolean(footer)}>
          <div className="modal__footer">{footer}</div>
        </Show>
      </div>
    </div>
  );
}
