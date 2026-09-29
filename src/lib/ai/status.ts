import type { AIStatus, AppSettings } from '@/types';
import { PROVIDER_MAP } from './providers';

export const AI_REQUIRED_HINT = 'Connect an AI provider to enable this feature.';

export function aiStatusFor(settings: AppSettings | undefined | null): AIStatus {
  if (!settings) return { ready: false, reason: 'Settings are still loading.' };
  const providerId = settings.ai.activeProviderId;
  if (!providerId) {
    return { ready: false, reason: 'No AI provider is active yet.' };
  }
  const connection = settings.ai.connections[providerId];
  if (!connection) {
    return { ready: false, providerId, reason: 'This provider has no saved credentials.' };
  }
  const def = PROVIDER_MAP[providerId];
  const needsKey = def && def.auth !== 'none';
  if (needsKey && !connection.apiKey && !connection.oauth?.accessToken) {
    return { ready: false, providerId, providerName: def?.name ?? providerId, reason: 'Add an API key for this provider.' };
  }
  // A connection that errored on its last call stays usable: the user is told
  // what went wrong and can simply retry. Only missing credentials block.
  return {
    ready: true,
    providerId,
    providerName: def?.name ?? providerId,
    model: connection.model || def?.defaultModel,
    reason: connection.status === 'error' ? connection.lastError : undefined,
  };
}

export function activeConnectionOf(settings: AppSettings | undefined | null) {
  const status = aiStatusFor(settings);
  if (!settings || !status.providerId) return null;
  return settings.ai.connections[status.providerId] ?? null;
}
