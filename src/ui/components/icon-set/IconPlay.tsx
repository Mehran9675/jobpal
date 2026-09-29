import type { IconProps } from './types';
import { iconBase } from './types';

export function IconPlay(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M7 4.5 19 12 7 19.5z" />
    </svg>
  );
}
