import type { IconProps } from './types';
import { iconBase } from './types';

export function IconGauge(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 14 16 9" />
    <path d="M4 20a9 9 0 1 1 16 0" />
    </svg>
  );
}
