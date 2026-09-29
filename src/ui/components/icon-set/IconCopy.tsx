import type { IconProps } from './types';
import { iconBase } from './types';

export function IconCopy(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="8.5" y="8.5" width="11" height="12" rx="2"/><path d="M5.5 15.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1"/>
    </svg>
  );
}
