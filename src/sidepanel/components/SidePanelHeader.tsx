import { Button } from '@/ui/components';
import { IconSettings } from '@/ui/components/Icons';

export function SidePanelHeader({ siteLabel, onOpenManagement }: { siteLabel: string; onOpenManagement: () => void }) {
  return (
    <header className="sidepanel__header">
      <div className="row">
        <div className="popup__logo">◈</div>
        <div>
          <div className="popup__name">JobPaal</div>
          <div className="popup__tagline">{siteLabel}</div>
        </div>
      </div>
      <Button variant="ghost" size="sm" icon={<IconSettings size={15} />} onClick={onOpenManagement} />
    </header>
  );
}
