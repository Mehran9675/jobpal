import type { IconProps } from './types';
import { iconBase } from './types';

export function IconExternal(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}
