import type { IconProps } from './types';
import { iconBase } from './types';

export function IconChevron(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="m9 6 6 6-6 6"/>
    </svg>
  );
}
