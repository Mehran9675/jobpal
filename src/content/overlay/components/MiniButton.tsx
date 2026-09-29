import type { ReactNode } from 'react';
import { Show } from '@/ui/components';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export function MiniButton({
  onClick,
  children,
  disabled,
  title,
  className = '',
  icon,
}: {
  onClick: () => void;
  children?: ReactNode;
  disabled?: boolean;
  title?: string;
  className?: string;
  icon?: IconName;
}) {
  return (
    <button
      type="button"
      className={`jp-mini ${className}`.trim()}
      disabled={disabled}
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Show if={Boolean(icon)}>
        <Icon name={icon as IconName} size={13} />
      </Show>
      <Show if={Boolean(children)}>
        <span>{children}</span>
      </Show>
    </button>
  );
}
