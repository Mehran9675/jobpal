import type { IconProps } from './types';
import { iconBase } from './types';

export function IconMessage(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z" />
    <path d="M9 11h6M9 14h3" />
    </svg>
  );
}
