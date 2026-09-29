import type { IconProps } from './types';
import { iconBase } from './types';

export function IconDownload(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" />
    </svg>
  );
}
