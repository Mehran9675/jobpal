import type { IconProps } from './types';
import { iconBase } from './types';

export function IconUpload(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 17V7m0 0-4 4m4-4 4 4M5 21h14" />
    </svg>
  );
}
