import type { IconProps } from './types';
import { iconBase } from './types';

export function IconTarget(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
