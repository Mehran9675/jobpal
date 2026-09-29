import { sendMessage } from '@/lib/messaging';
import { formatTokens } from '@/lib/ai/usage';
import { useOverlayState } from '../store';
import { MiniButton } from './MiniButton';

export function UsageRow() {
  const state = useOverlayState();
  const label = `${state.tokensToday > 0 ? formatTokens(state.tokensToday) : '0'} tokens today · ${formatTokens(state.tokensTotal)} all-time`;

  return (
    <div className="jp-usage">
      <span className="jp-guide-value">{label}</span>
      <MiniButton onClick={() => void sendMessage('app.openOptions', { tab: 'ai' })}>Usage report</MiniButton>
    </div>
  );
}
