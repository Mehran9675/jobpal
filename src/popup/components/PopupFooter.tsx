import { IconExternal } from '@/ui/components/Icons';

export function PopupFooter({
  providerName,
  tokensToday,
  onUsage,
  onManage,
}: {
  providerName: string;
  tokensToday: string;
  onUsage: () => void;
  onManage: () => void;
}) {
  return (
    <footer className="popup__footer">
      <span>
        v{chrome.runtime.getManifest().version} · {providerName}
        {tokensToday ? ` · ${tokensToday} tokens today` : ''}
      </span>
      <div className="row" style={{ gap: 4 }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onUsage}>
          Usage
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onManage}>
          Manage <IconExternal size={12} />
        </button>
      </div>
    </footer>
  );
}
