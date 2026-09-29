import { useOverlayState } from '../store';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export function ActionButton({
  label,
  icon,
  variant = 'jp-btn',
  onClick,
  disabled,
  title,
}: {
  label: string;
  icon: IconName;
  variant?: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const state = useOverlayState();
  return (
    <button type="button" className={variant} disabled={disabled || state.busy || state.picking} title={title} onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}
