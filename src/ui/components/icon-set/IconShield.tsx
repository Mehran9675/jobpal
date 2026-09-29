import type { IconProps } from './types';
import { iconBase } from './types';

export function IconShield(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 3 5 6v6c0 4.5 3 8.2 7 9 4-.8 7-4.5 7-9V6z" />
    <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
