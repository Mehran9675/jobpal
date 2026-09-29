import type { IconProps } from './types';
import { iconBase } from './types';

export function IconMoney(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.2"/><circle cx="12" cy="12" r="2.6"/>
    </svg>
  );
}
