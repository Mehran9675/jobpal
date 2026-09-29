import { Icon } from './Icon';
import type { IconName } from './Icon';

export function IconMenuItem({ label, icon, onSelect, disabled }: { label: string; icon: IconName; onSelect: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="jp-doc-menu-item"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <Icon name={icon} size={14} />
      <span>{label}</span>
    </button>
  );
}
