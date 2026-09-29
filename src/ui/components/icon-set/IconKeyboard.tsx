import type { IconProps } from './types';
import { iconBase } from './types';

export function IconKeyboard(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2.5"/><path d="M6.5 10.5h.01M10 10.5h.01M13.5 10.5h.01M17 10.5h.01M7 14h10"/>
    </svg>
  );
}
