import type { IconProps } from './types';
import { iconBase } from './types';

export function IconCpu(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="7" y="7" width="10" height="10" rx="2" />
    <path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2" />
    </svg>
  );
}
