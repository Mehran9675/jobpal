import type { IconProps } from './types';
import { iconBase } from './types';

export function IconClipboard(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="6" y="4.5" width="12" height="16" rx="2"/><path d="M9.5 4.5V3h5v1.5M9.5 10h5M9.5 13.5h3"/>
    </svg>
  );
}
