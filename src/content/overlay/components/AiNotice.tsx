import { sendMessage } from '@/lib/messaging';
import { useOverlayState } from '../store';
import { MiniButton } from './MiniButton';
import { StatusMessage } from './StatusMessage';

export function AiNotice() {
  const state = useOverlayState();
  return (
    <StatusMessage tone="warn">
      {state.aiReason ? `${state.aiReason} ` : ''}
      <MiniButton onClick={() => void sendMessage('app.openOptions', { tab: 'ai' })}>Connect AI</MiniButton>
    </StatusMessage>
  );
}
