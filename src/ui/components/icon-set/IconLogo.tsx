import type { IconProps } from './types';
import { iconBase } from './types';

export function IconLogo(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="3.5" y="7" width="17" height="12.5" rx="3"/><path d="M9 7V5.4A1.4 1.4 0 0 1 10.4 4h3.2A1.4 1.4 0 0 1 15 5.4V7"/>
    </svg>
  );
}
