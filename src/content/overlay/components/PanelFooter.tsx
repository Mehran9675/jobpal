import { sendMessage } from '@/lib/messaging';

export function PanelFooter() {
  return (
    <div className="jp-foot">
      <span>v{chrome.runtime.getManifest().version}</span>
      <button type="button" className="jp-link" onClick={() => void sendMessage('app.openOptions', { tab: 'dashboard' })}>
        Open management page
      </button>
    </div>
  );
}
