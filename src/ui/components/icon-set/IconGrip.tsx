import type { IconProps } from './types';
import { iconBase } from './types';

export function IconGrip(props: IconProps) {
  return (
    <svg {...iconBase(props)} fill="currentColor" stroke="none">
      <circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/>
    </svg>
  );
}
