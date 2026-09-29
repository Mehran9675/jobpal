import type { IconProps } from './types';
import { iconBase } from './types';

export function IconTrash(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  );
}
