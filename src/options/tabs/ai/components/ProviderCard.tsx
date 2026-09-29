import type { ProviderConnection, ProviderDef } from '@/types';
import { Badge, Button, Select, Show } from '@/ui/components';
import { IconExternal } from '@/ui/components/Icons';
import { modelOptions } from '../helpers/modelOptions';

export function ProviderCard({
  provider,
  connection,
  isActive,
  onConfigure,
  onActivate,
  onSetModel,
}: {
  provider: ProviderDef;
  connection?: ProviderConnection;
  isActive: boolean;
  onConfigure: (provider: ProviderDef) => void;
  onActivate: (provider: ProviderDef) => void;
  onSetModel: (providerId: string, model: string) => void;
}) {
  const liveModelCount = connection?.models?.length ?? 0;

  const renderModelOption = (model: { id: string; label: string }) => (
    <option key={model.id} value={model.id}>
      {model.label}
    </option>
  );

  const renderProviderModelChip = (model: { id: string; label: string }) => (
    <span className="chip" key={model.id}>
      {model.label}
    </span>
  );

  return (
    <div className={`provider-card ${isActive ? 'active' : ''}`}>
      <div className="provider-card__head">
        <div>
          <div className="provider-card__name">{provider.name}</div>
          <div className="tiny muted">
            {provider.kind === 'openai' ? 'OpenAI-compatible' : provider.kind} · {provider.auth === 'none' ? 'no key' : provider.auth === 'oauth2' ? 'OAuth 2.0' : 'API key'}
          </div>
        </div>
        <Show if={isActive}>
          <Badge tone="success">Active</Badge>
        </Show>
        <Show if={!isActive && Boolean(connection)}>
          <Badge tone={connection?.status === 'ok' ? 'success' : connection?.status === 'error' ? 'danger' : 'neutral'}>{connection?.status}</Badge>
        </Show>
      </div>
      <div className="provider-card__desc">{provider.description}</div>
      <div className="provider-card__meta">
        <Show if={Boolean(provider.local)}>
          <span className="chip">local</span>
        </Show>
        <Show if={Boolean(provider.free)}>
          <span className="chip">free</span>
        </Show>
        <Show if={liveModelCount > 0}>
          <span className="chip">{liveModelCount} live models</span>
        </Show>
        <Show if={liveModelCount === 0}>{provider.models.slice(0, 2).map(renderProviderModelChip)}</Show>
      </div>
      <Show if={Boolean(connection)}>
        <Select value={connection?.model ?? provider.defaultModel} onChange={(event) => onSetModel(provider.id, event.target.value)}>
          {modelOptions(provider, connection).map(renderModelOption)}
        </Select>
      </Show>
      <div className="row">
        <Button size="sm" variant="primary" onClick={() => onConfigure(provider)}>
          {connection ? 'Manage' : 'Connect'}
        </Button>
        <Show if={Boolean(connection) && !isActive}>
          <Button size="sm" variant="outline" onClick={() => onActivate(provider)}>
            Activate
          </Button>
        </Show>
        <Show if={Boolean(provider.docsUrl)}>
          <Button size="sm" variant="ghost" icon={<IconExternal size={13} />} onClick={() => void window.open(provider.docsUrl, '_blank')}>
            Docs
          </Button>
        </Show>
      </div>
    </div>
  );
}
