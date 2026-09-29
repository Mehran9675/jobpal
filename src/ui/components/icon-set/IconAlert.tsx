import type { IconProps } from './types';
import { iconBase } from './types';

export function IconAlert(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 3.5 2.6 20h18.8L12 3.5z" />
      <path d="M12 9.5v5" />
      <path d="M12 17.6h.01" />
    </svg>
  );
}
