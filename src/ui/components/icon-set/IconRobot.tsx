import type { IconProps } from './types';
import { iconBase } from './types';

export function IconRobot(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="4" y="8" width="16" height="11" rx="3" />
    <path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5" />
    </svg>
  );
}
