import type { IconProps } from './types';
import { iconBase } from './types';

export function IconPause(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="7" y="5" width="3.6" height="14" rx="1" />
    <rect x="13.4" y="5" width="3.6" height="14" rx="1" />
    </svg>
  );
}
