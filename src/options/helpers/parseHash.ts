export interface AppRoute {
  tab: string;
  param?: string;
}

export function parseHash(hash: string): AppRoute {
  const raw = hash.replace(/^#\/?/, '');
  const [tab = 'dashboard', param] = raw.split('/');
  return { tab: tab || 'dashboard', param };
}
