import type { IconProps } from './types';
import { iconBase } from './types';

export function IconRefresh(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M20 11a8 8 0 0 0-14-4M4 5v4h4M4 13a8 8 0 0 0 14 4M20 19v-4h-4" />
    </svg>
  );
}
