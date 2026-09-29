import { patchOverlay } from '../store';
import { MiniButton } from './MiniButton';
import { StatusMessage } from './StatusMessage';

export function NoJobNotice() {
  return (
    <StatusMessage tone="warn">
      No job detected on this page. <MiniButton onClick={() => patchOverlay({ guideOpen: true })}>Guide me</MiniButton>
    </StatusMessage>
  );
}
