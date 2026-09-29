import type { IconProps } from './types';
import { iconBase } from './types';

export function IconPlus(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
