import type { AppSettings, ApplicationRecord } from '@/types';
import type { AppRoute } from '../helpers/parseHash';
import { DashboardTab } from '../tabs/DashboardTab';
import { ProfileTab } from '../tabs/ProfileTab';
import { DocumentsTab } from '../tabs/DocumentsTab';
import { ApplicationsTab } from '../tabs/ApplicationsTab';
import { TemplatesTab } from '../tabs/TemplatesTab';
import { AITab } from '../tabs/AITab';
import { PromptsTab } from '../tabs/PromptsTab';
import { SettingsTab } from '../tabs/SettingsTab';
import { TermsTab } from '../tabs/TermsTab';

export function TabContent({
  route,
  settings,
  patchSettings,
  applications,
  navigate,
  lastEvent,
}: {
  route: AppRoute;
  settings: AppSettings;
  patchSettings: (patch: Record<string, unknown>) => Promise<AppSettings>;
  applications: ApplicationRecord[];
  navigate: (tab: string, param?: string) => void;
  lastEvent: number;
}) {
  switch (route.tab) {
    case 'profile':
      return <ProfileTab settings={settings} patchSettings={patchSettings} />;
    case 'documents':
      return <DocumentsTab applications={applications} navigate={navigate} settings={settings} />;
    case 'applications':
      return <ApplicationsTab applications={applications} selectedId={route.param} navigate={navigate} settings={settings} key={lastEvent} />;
    case 'templates':
      return <TemplatesTab settings={settings} patchSettings={patchSettings} />;
    case 'ai':
      return <AITab settings={settings} patchSettings={patchSettings} />;
    case 'prompts':
      return <PromptsTab settings={settings} patchSettings={patchSettings} />;
    case 'settings':
      return <SettingsTab settings={settings} patchSettings={patchSettings} />;
    case 'terms':
      return <TermsTab settings={settings} />;
    default:
      return <DashboardTab applications={applications} settings={settings} navigate={navigate} patchSettings={patchSettings} />;
  }
}
