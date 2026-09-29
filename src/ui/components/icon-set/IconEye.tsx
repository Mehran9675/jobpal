import type { IconProps } from './types';
import { iconBase } from './types';

export function IconEye(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
