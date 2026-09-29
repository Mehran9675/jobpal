import type { IconProps } from './types';
import { iconBase } from './types';

export function IconX(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
