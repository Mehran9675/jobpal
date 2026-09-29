import type { IconProps } from './types';
import { iconBase } from './types';

export function IconFile(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}
