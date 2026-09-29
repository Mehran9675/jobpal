import type { IconProps } from './types';
import { iconBase } from './types';

export function IconSend(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4z" />
    </svg>
  );
}
