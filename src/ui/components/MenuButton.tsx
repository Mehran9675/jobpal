import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconDots } from './icon-set';
import { Show } from './Show';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

/** A single “…” button that opens a context menu with every action. */
export function MenuButton({ items, label = 'More actions' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const renderMenuItem = (item: MenuItem) => (
    <button
      type="button"
      key={item.label}
      role="menuitem"
      className={`menu__item ${item.danger ? 'menu__item--danger' : ''}`}
      onClick={() => {
        setOpen(false);
        item.onSelect();
      }}
    >
      <Show if={Boolean(item.icon)}>
        <span className="menu__icon">{item.icon}</span>
      </Show>
      <span>{item.label}</span>
    </button>
  );

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="btn btn--ghost btn--sm menu__trigger" aria-label={label} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <IconDots size={15} />
      </button>
      <Show if={open}>
        <div className="menu__list" role="menu">
          {items.map(renderMenuItem)}
        </div>
      </Show>
    </div>
  );
}
