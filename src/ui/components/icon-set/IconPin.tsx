import type { IconProps } from './types';
import { iconBase } from './types';

export function IconPin(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>
    </svg>
  );
}
