import type { IconProps } from './types';
import { iconBase } from './types';

export function IconUser(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}
