import type { IconProps } from './types';
import { iconBase } from './types';

export function IconBriefcase(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12h18" />
    </svg>
  );
}
