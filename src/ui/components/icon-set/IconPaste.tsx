import type { IconProps } from './types';
import { iconBase } from './types';

export function IconPaste(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M9 4h6v3H9zM7 6H5.5A1.5 1.5 0 0 0 4 7.5v12A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 18.5 6H17" />
    <path d="M8 12h8M8 16h5" />
    </svg>
  );
}
