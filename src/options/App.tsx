import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApplications, useRuntimeEvents, useSettings, useTheme } from '@/ui/hooks';
import { parseHash, type AppRoute } from './helpers/parseHash';
import type { NavItem } from './constants/nav';
import { AppSidebar } from './components/AppSidebar';
import { TabContent } from './components/TabContent';
import { WelcomeBanner } from './tabs/WelcomeBanner';

export function OptionsApp() {
  const { settings, patch } = useSettings();
  useTheme(settings);
  const [route, setRoute] = useState<AppRoute>(() => parseHash(window.location.hash));
  const [lastEvent, setLastEvent] = useState(0);
  const { applications, reload: reloadApplications } = useApplications();

  useEffect(() => {
    const listener = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);

  useRuntimeEvents((name) => {
    // Any application or document mutation must refresh the list, otherwise the
    // management page keeps showing the pre-edit data until a manual reload.
    if (name === 'applications-changed' || name === 'job-updated') {
      void reloadApplications();
      setLastEvent(Date.now());
    }
  });

  const navigate = useCallback((tab: string, param?: string) => {
    window.location.hash = `#${tab}${param ? `/${param}` : ''}`;
    setRoute({ tab, param });
  }, []);

  const openNav = useCallback((item: NavItem) => navigate(item.id), [navigate]);

  const pendingCount = useMemo(() => applications.filter((application) => application.status === 'ready').length, [applications]);
  const providerLabel = settings.ai.activeProviderId ? `AI: ${settings.ai.activeProviderId}` : 'AI: not connected';

  return (
    <div className="shell">
      <AppSidebar activeTab={route.tab} pendingCount={pendingCount} providerLabel={providerLabel} onNavigate={openNav} />
      <main className="main">
        <WelcomeBanner onNavigate={navigate} />
        <TabContent
          route={route}
          settings={settings}
          patchSettings={patch}
          applications={applications}
          navigate={navigate}
          lastEvent={lastEvent}
        />
      </main>
    </div>
  );
}
