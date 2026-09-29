import type { IconProps } from './types';
import { iconBase } from './types';

export function IconAttach(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M16.5 7.5 9.4 14.6a3 3 0 0 0 4.2 4.2l7-7a5 5 0 0 0-7-7l-7 7"/>
    </svg>
  );
}
