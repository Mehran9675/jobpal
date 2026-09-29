import type { IconProps } from './types';
import { iconBase } from './types';

export function IconFolder(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    </svg>
  );
}
