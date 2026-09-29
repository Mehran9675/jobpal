import type { IconProps } from './types';
import { iconBase } from './types';

export function IconBuilding(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="4.5" y="3" width="15" height="18" rx="1.6"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4.5h4V21"/>
    </svg>
  );
}
