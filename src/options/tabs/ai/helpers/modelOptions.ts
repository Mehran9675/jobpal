import type { ProviderConnection, ProviderDef, ProviderModel } from '@/types';

export function modelOptions(provider: ProviderDef, connection?: ProviderConnection, live: ProviderModel[] = []): { id: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const model of [...live, ...(connection?.models ?? []), ...provider.models]) {
    if (model.id && !seen.has(model.id)) seen.set(model.id, model.label || model.id);
  }
  const current = connection?.model || provider.defaultModel;
  if (current && !seen.has(current)) seen.set(current, `${current} (current)`);
  if (provider.defaultModel && !seen.has(provider.defaultModel)) seen.set(provider.defaultModel, `${provider.defaultModel} (provider default)`);
  return [...seen.entries()].map(([id, label]) => ({ id, label }));
}
