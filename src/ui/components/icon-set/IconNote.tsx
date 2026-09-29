import type { IconProps } from './types';
import { iconBase } from './types';

export function IconNote(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M8 3h8l4 4v14H4V3z" />
    <path d="M8 10h8M8 14h5" />
    </svg>
  );
}
