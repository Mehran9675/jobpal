import type { IconProps } from './types';
import { iconBase } from './types';

export function IconCheck(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}
