import type { IconProps } from './types';
import { iconBase } from './types';

export function IconTag(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M20 12.5 12.5 20 4 11.5V4h7.5z"/><circle cx="8.2" cy="8.2" r="1.3"/>
    </svg>
  );
}
