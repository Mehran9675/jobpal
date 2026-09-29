import { NAV_ITEMS, NAV_SECTIONS, type NavItem } from '../constants/nav';
import { SidebarNavButton } from './SidebarNavButton';
import { IconSparkles } from '@/ui/components/Icons';

export function AppSidebar({
  activeTab,
  pendingCount,
  providerLabel,
  onNavigate,
}: {
  activeTab: string;
  pendingCount: number;
  providerLabel: string;
  onNavigate: (item: NavItem) => void;
}) {
  const renderNavItem = (item: NavItem) => (
    <SidebarNavButton
      key={item.id}
      item={item}
      active={activeTab === item.id}
      badge={item.id === 'applications' ? pendingCount : undefined}
      onSelect={onNavigate}
    />
  );

  const renderSection = (section: string) => (
    <div key={section}>
      <div className="sidebar__section">{section}</div>
      {NAV_ITEMS.filter((item) => item.section === section).map(renderNavItem)}
    </div>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">◈</div>
        <div>
          <div className="sidebar__title">JobPaal</div>
          <div className="sidebar__subtitle">Application copilot</div>
        </div>
      </div>
      {NAV_SECTIONS.map(renderSection)}
      <div className="sidebar__footer">
        <div>v{chrome.runtime.getManifest().version}</div>
        <div className="row mt-1" style={{ gap: 6 }}>
          <IconSparkles size={12} />
          <span>{providerLabel}</span>
        </div>
      </div>
    </aside>
  );
}
