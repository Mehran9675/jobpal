import type { NavItem } from '../constants/nav';
import { Show } from '@/ui/components';

export function SidebarNavButton({
  item,
  active,
  badge,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
  onSelect: (item: NavItem) => void;
}) {
  return (
    <button className={`sidebar__nav ${active ? 'active' : ''}`} onClick={() => onSelect(item)}>
      {item.icon}
      <span>{item.label}</span>
      <Show if={Boolean(badge && badge > 0)}>
        <span className="sidebar__nav__badge">{badge}</span>
      </Show>
    </button>
  );
}
