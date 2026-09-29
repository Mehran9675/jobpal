import type { IconProps } from './types';
import { iconBase } from './types';

export function IconPalette(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H13a2 2 0 0 1 0-4h5a3 3 0 0 0 3-3 6 6 0 0 0-6-6z" />
    <circle cx="7.5" cy="11" r="1.1" fill="currentColor" />
    <circle cx="10" cy="7" r="1.1" fill="currentColor" />
    <circle cx="14.5" cy="7" r="1.1" fill="currentColor" />
    </svg>
  );
}
