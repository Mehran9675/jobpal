import type { IconProps } from './types';
import { iconBase } from './types';

export function IconSparkles(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}
