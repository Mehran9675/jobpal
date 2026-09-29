import { Button } from '@/ui/components';
import { IconSettings } from '@/ui/components/Icons';

export function PopupHeader({ onOpenManagement }: { onOpenManagement: () => void }) {
  return (
    <header className="popup__header">
      <div className="popup__brand">
        <div className="popup__logo">◈</div>
        <div>
          <div className="popup__name">JobPal</div>
          <div className="popup__tagline">AI applications, on autopilot</div>
        </div>
      </div>
      <div className="row">
        <Button variant="ghost" size="sm" aria-label="Management page" icon={<IconSettings size={15} />} onClick={onOpenManagement} />
      </div>
    </header>
  );
}
