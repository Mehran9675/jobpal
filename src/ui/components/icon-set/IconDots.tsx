import type { IconProps } from './types';
import { iconBase } from './types';

export function IconDots(props: IconProps) {
  return (
    <svg {...iconBase(props)} fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
    </svg>
  );
}
