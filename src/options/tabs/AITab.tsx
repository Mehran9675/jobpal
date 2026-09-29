import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppSettings, ProviderConnection, ProviderDef, ProviderModel, ProviderUsageReport, UsageRecord, UsageSummary } from '@/types';
import { PROVIDER_MAP, providerGroups } from '@/lib/ai/providers';
import { aiStatusFor } from '@/lib/ai/status';
import { formatTokens, todayUsage } from '@/lib/ai/usage';
import { sendMessage, errorMessage } from '@/lib/messaging';
import { Badge, Button, Field, Input, Progress, SectionCard, Select, Show } from '@/ui/components';
import { IconCheck, IconCpu, IconExternal, IconLink, IconRefresh, IconShield, IconTrash } from '@/ui/components/Icons';
import { useToast } from '@/ui/components/Toast';
import { ProviderCard } from './ai/components/ProviderCard';
import { ProviderUsageRow } from './ai/components/ProviderUsageRow';
import { emptyDraftConnection, type DraftConnection } from './ai/helpers/draftConnection';
import { modelOptions } from './ai/helpers/modelOptions';

export { AITabIcon } from './ai/components/AITabIcon';

export function AITab({ settings, patchSettings }: { settings: AppSettings; patchSettings: (patch: Record<string, unknown>) => Promise<AppSettings> }) {
  const toast = useToast();
  const [editing, setEditing] = useState<ProviderDef | null>(null);
  const [draft, setDraft] = useState<DraftConnection>(emptyDraftConnection);
  const [liveModels, setLiveModels] = useState<ProviderModel[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [providerUsage, setProviderUsage] = useState<ProviderUsageReport | null>(null);

  const groups = useMemo(() => providerGroups(), []);
  const activeId = settings.ai.activeProviderId;
  const status = aiStatusFor(settings);

  const loadUsage = useCallback(async () => {
    try {
      setUsage(await sendMessage('ai.usage', undefined));
    } catch {
      /* usage counters are best-effort */
    }
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const connectionFor = (providerId: string): ProviderConnection | undefined => settings.ai.connections[providerId];

  const openConfigure = (provider: ProviderDef) => {
    const connection = connectionFor(provider.id);
    setEditing(provider);
    setLiveModels(connection?.models ?? []);
    setTestResult(null);
    setProviderUsage(null);
    setDraft({
      apiKey: connection?.apiKey ?? '',
      baseUrl: connection?.baseUrl ?? '',
      model: connection?.model ?? provider.defaultModel,
      customModel: '',
      clientId: provider.oauth?.clientId ?? '',
      headersText: connection?.extraHeaders ? JSON.stringify(connection.extraHeaders, null, 1) : '',
    });
  };

  const fetchLiveModels = useCallback(
    async (providerId: string, quiet = false): Promise<void> => {
      setBusy('models');
      try {
        const result = await sendMessage('ai.refreshModels', { providerId }, { timeout: 60000 });
        setLiveModels(result.models);
        if (!quiet) toast.success(`Loaded ${result.models.length} live model${result.models.length === 1 ? '' : 's'} from ${PROVIDER_MAP[providerId]?.name ?? providerId}.`);
      } catch (error) {
        if (!quiet) toast.error(`Could not load models: ${errorMessage(error)}`);
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );

  const saveConnection = async (activate = true) => {
    if (!editing) return;
    setBusy('save');
    try {
      let extraHeaders: Record<string, string> | null = null;
      if (draft.headersText.trim()) {
        try {
          extraHeaders = JSON.parse(draft.headersText) as Record<string, string>;
        } catch {
          throw new Error('Extra headers must be valid JSON.');
        }
      }
      const existing = connectionFor(editing.id) ?? { providerId: editing.id, status: 'untested' as const };
      const connection: ProviderConnection = {
        ...existing,
        providerId: editing.id,
        apiKey: (draft.apiKey.trim() || null) as unknown as string | undefined,
        baseUrl: (draft.baseUrl.trim() || null) as unknown as string | undefined,
        model: (draft.customModel.trim() || draft.model || null) as unknown as string | undefined,
        extraHeaders: extraHeaders as Record<string, string> | undefined,
      };
      await patchSettings({
        ai: {
          activeProviderId: activate ? editing.id : activeId,
          connections: { [editing.id]: connection },
        },
      });
      toast.success(activate ? `${editing.name} is now your active provider.` : 'Connection saved.');
      const providerId = editing.id;
      if (activate) setEditing(null);
      void fetchLiveModels(providerId, true);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    if (!editing) return;
    setBusy('test');
    setTestResult(null);
    try {
      const connection: ProviderConnection = {
        providerId: editing.id,
        apiKey: draft.apiKey.trim() || undefined,
        baseUrl: draft.baseUrl.trim() || undefined,
        model: draft.customModel.trim() || draft.model || undefined,
        status: 'untested',
      };
      const result = await sendMessage('ai.test', { connection }, { timeout: 60000 });
      setTestResult({ ok: result.ok, message: result.message });
      if (result.ok) await fetchLiveModels(editing.id, true);
      const existing = connectionFor(editing.id) ?? { providerId: editing.id, status: 'untested' as const };
      await patchSettings({
        ai: {
          connections: {
            [editing.id]: { ...existing, status: result.ok ? 'ok' : 'error', lastError: result.ok ? undefined : result.message, verifiedAt: Date.now() },
          },
        },
      });
    } catch (error) {
      setTestResult({ ok: false, message: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const startOAuth = async () => {
    if (!editing) return;
    setBusy('oauth');
    try {
      const result = await sendMessage('ai.oauth.start', { providerId: editing.id, clientId: draft.clientId || undefined }, { timeout: 300000 });
      if (result.ok) toast.success('Signed in. You can now save and activate this provider.');
      else toast.warning(result.message ?? 'Sign-in was cancelled.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const removeConnection = async (providerId: string) => {
    if (!confirm('Remove this connection and its API key?')) return;
    await patchSettings({
      ai: {
        connections: { [providerId]: null },
        activeProviderId: activeId === providerId ? null : activeId,
      },
    });
    toast.push('Connection removed.');
  };

  const setModel = async (providerId: string, model: string, silent = false) => {
    const existing = connectionFor(providerId) ?? { providerId, status: 'untested' as const };
    await patchSettings({ ai: { connections: { [providerId]: { ...existing, model } } } });
    if (!silent) toast.success(`Model set to ${model}.`);
  };

  const activateProvider = (provider: ProviderDef) => {
    void patchSettings({ ai: { activeProviderId: provider.id } }).then(() => toast.success(`${provider.name} activated.`));
  };

  const patchAi = (patch: Partial<AppSettings['ai']>) => patchSettings({ ai: { ...settings.ai, ...patch } });

  const resetCounters = async () => {
    if (!confirm('Reset the locally counted usage? Provider-side billing is not affected.')) return;
    setUsage(await sendMessage('ai.usage.reset', undefined));
    setProviderUsage(null);
    toast.push('Usage counters reset.');
  };

  const loadProviderUsage = async (providerId?: string) => {
    setBusy('provider-usage');
    try {
      setProviderUsage(await sendMessage('ai.usage.provider', { providerId }, { timeout: 30000 }));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const renderModelOption = (model: { id: string; label: string }) => (
    <option key={model.id} value={model.id}>
      {model.label}
    </option>
  );

  const renderProviderUsageRow = ([providerId, record]: [string, UsageRecord]) => <ProviderUsageRow key={providerId} providerId={providerId} record={record} />;

  const renderProviderUsageReportRow = (row: { label: string; value: string }) => (
    <div className="row row--between" key={row.label}>
      <span className="small muted">{row.label}</span>
      <span className="strong">{row.value}</span>
    </div>
  );

  const renderProvider = (provider: ProviderDef) => (
    <ProviderCard
      key={provider.id}
      provider={provider}
      connection={connectionFor(provider.id)}
      isActive={activeId === provider.id}
      onConfigure={openConfigure}
      onActivate={activateProvider}
      onSetModel={setModel}
    />
  );

  const renderProviderGroup = (group: { label: string; providers: ProviderDef[] }) => (
    <SectionCard key={group.label} title={group.label}>
      <div className="provider-grid">{group.providers.map(renderProvider)}</div>
    </SectionCard>
  );

  if (editing) {
    const connection = connectionFor(editing.id);
    const usesOAuth = editing.auth === 'oauth2';
    const options = modelOptions(editing, connection, liveModels);
    return (
      <>
        <header className="main__header">
          <div>
            <Button size="sm" variant="ghost" className="mb-2" onClick={() => setEditing(null)}>
              ← All providers
            </Button>
            <h1 className="main__title">{editing.name}</h1>
            <p className="main__subtitle">{editing.description}</p>
          </div>
          <div className="row">
            <Show if={Boolean(editing.keyUrl)}>
              <Button variant="outline" icon={<IconExternal size={15} />} onClick={() => void window.open(editing.keyUrl, '_blank')}>
                Get an API key
              </Button>
            </Show>
          </div>
        </header>

        <SectionCard title="Connection">
          <Show if={Boolean(editing.custom)}>
            <Field label="Base URL" hint="Full base URL, including /v1 if the service needs it.">
              <Input value={draft.baseUrl} placeholder={editing.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} />
            </Field>
          </Show>
          <Show if={!usesOAuth && editing.auth !== 'none'}>
            <Field label="API key" hint="Stored locally in chrome.storage. It is only sent to the provider you configure.">
              <Input type="password" value={draft.apiKey} placeholder={connection?.apiKey ? '•••••••••••• (saved)' : 'sk-…'} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} />
            </Field>
          </Show>
          <Show if={usesOAuth}>
            <Field label="OAuth client ID" hint="Public client (PKCE, no secret). Leave blank to use a built-in default when available.">
              <div className="row">
                <Input value={draft.clientId} onChange={(event) => setDraft({ ...draft, clientId: event.target.value })} placeholder="your-client-id.apps.googleusercontent.com" />
                <Button variant="primary" icon={<IconLink size={15} />} loading={busy === 'oauth'} onClick={() => void startOAuth()}>
                  Sign in
                </Button>
              </div>
            </Field>
          </Show>
          <Show if={editing.auth === 'none'}>
            <div className="list-item mb-2">
              <IconShield size={16} />
              <div className="list-item__main">
                <div className="list-item__title">No API key required</div>
                <div className="list-item__meta">{editing.local ? 'Make sure the local server is running and CORS is enabled for extensions.' : 'This endpoint is keyless.'}</div>
              </div>
            </div>
          </Show>

          <div className="grid grid--2">
            <Field
              label="Model"
              hint={`${options.length} model${options.length === 1 ? '' : 's'} available — the list is refreshed live from the provider when you save or press Refresh.`}
              action={
                <Button size="sm" variant="ghost" icon={<IconRefresh size={13} />} loading={busy === 'models'} onClick={() => void fetchLiveModels(editing.id)}>
                  Refresh
                </Button>
              }
            >
              <Select value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })}>
                <Show if={!draft.model}>
                  <option value="">Provider default ({editing.defaultModel || 'set below'})</option>
                </Show>
                {options.map(renderModelOption)}
              </Select>
            </Field>
            <Field label="Custom model ID" hint="Overrides the dropdown — useful for brand-new models, snapshots or Azure deployments.">
              <Input value={draft.customModel} placeholder={editing.id === 'azure-openai' ? 'deployment name' : 'e.g. deepseek-v4.1'} onChange={(event) => setDraft({ ...draft, customModel: event.target.value })} />
            </Field>
          </div>

          <Field label="Extra headers (JSON)" hint="Optional. Example: {&quot;X-Custom&quot;: &quot;value&quot;}">
            <Input value={draft.headersText} placeholder='{"HTTP-Referer": "https://…"}' onChange={(event) => setDraft({ ...draft, headersText: event.target.value })} />
          </Field>

          <Show if={Boolean(testResult)}>
            <div className={`toast toast--${testResult?.ok ? 'success' : 'error'}`} style={{ maxWidth: '100%', marginBottom: 12 }}>
              <span>{testResult?.ok ? '✅' : '⛔'}</span>
              <span>{testResult?.message}</span>
            </div>
          </Show>

          <div className="row">
            <Button variant="outline" icon={<IconRefresh size={15} />} loading={busy === 'test'} onClick={() => void test()}>
              Test connection
            </Button>
            <Button variant="primary" icon={<IconCheck size={15} />} loading={busy === 'save'} onClick={() => void saveConnection(true)}>
              Save & activate
            </Button>
            <Button variant="ghost" onClick={() => void saveConnection(false)}>
              Save without activating
            </Button>
            <Show if={Boolean(connection)}>
              <Button variant="danger" icon={<IconTrash size={15} />} onClick={() => void removeConnection(editing.id).then(() => setEditing(null))}>
                Remove
              </Button>
            </Show>
          </div>
        </SectionCard>
      </>
    );
  }

  const today = usage ? todayUsage(usage) : null;

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">AI providers</h1>
          <p className="main__subtitle">
            Bring your own AI: frontier labs, cheap inference clouds, local servers, or any OpenAI-compatible endpoint. Every AI-powered feature stays disabled
            until a provider is connected and active.
          </p>
        </div>
        <Show if={status.ready}>
          <Badge tone="success">
            <IconCheck size={12} /> Active: {status.providerName}
            {status.model ? ` · ${status.model}` : ''}
          </Badge>
        </Show>
        <Show if={!status.ready}>
          <Badge tone="warning">No AI connected — AI features are disabled</Badge>
        </Show>
      </header>

      <SectionCard title="Generation settings" hint="Applies to every AI call unless a task overrides it. If a call fails, the action stops and reports the provider error — nothing is generated locally.">
        <div className="grid grid--4">
          <Field label="Temperature">
            <Input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={settings.ai.temperature}
              onChange={(event) => void patchAi({ temperature: Number(event.target.value) })}
            />
          </Field>
          <Field label="Max output tokens">
            <Input type="number" min={256} step={256} value={settings.ai.maxTokens} onChange={(event) => void patchAi({ maxTokens: Number(event.target.value) })} />
          </Field>
          <Field label="Timeout (seconds)">
            <Input type="number" min={10} step={5} value={Math.round(settings.ai.timeoutMs / 1000)} onChange={(event) => void patchAi({ timeoutMs: Number(event.target.value) * 1000 })} />
          </Field>
          <Field label="Token budget warning" hint="Warn me once when cumulative usage reaches this many tokens. 0 disables the warning.">
            <Input type="number" min={0} step={1000} value={settings.ai.tokenBudget} onChange={(event) => void patchAi({ tokenBudget: Number(event.target.value) })} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Usage"
        hint="Every call is counted locally with the token usage the provider reports back. Account-level figures are pulled from the provider where its API supports it."
        action={
          <div className="row">
            <Button size="sm" variant="outline" icon={<IconRefresh size={14} />} loading={busy === 'provider-usage'} onClick={() => void loadProviderUsage(activeId ?? undefined)}>
              Fetch provider usage
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void resetCounters()}>
              Reset counters
            </Button>
          </div>
        }
      >
        <div className="grid grid--4">
          <div className="stat">
            <div className="stat__value">{usage?.total.calls ?? 0}</div>
            <div className="stat__label">AI calls (all time)</div>
          </div>
          <div className="stat">
            <div className="stat__value">{formatTokens(usage?.total.totalTokens ?? 0)}</div>
            <div className="stat__label">Tokens (all time)</div>
          </div>
          <div className="stat">
            <div className="stat__value">{today?.calls ?? 0}</div>
            <div className="stat__label">Calls today</div>
          </div>
          <div className="stat">
            <div className="stat__value">
              {today?.totalTokens !== undefined ? formatTokens(today.totalTokens) : '0'}
            </div>
            <div className="stat__label">Tokens today</div>
          </div>
        </div>

        <Show if={(usage?.total.errors ?? 0) > 0}>
          <p className="small muted mt-2">
            {usage?.total.errors} failed call{usage?.total.errors === 1 ? '' : 's'} recorded. Failures are counted so you can spot keys or quotas that need attention.
          </p>
        </Show>

        <Show if={settings.ai.tokenBudget > 0}>
          <div className="mt-2">
            <div className="row row--between mb-1">
              <span className="tiny muted">
                {formatTokens(usage?.total.totalTokens ?? 0)} of your {formatTokens(settings.ai.tokenBudget)} token budget used
              </span>
              <span className="tiny muted">{Math.min(100, Math.round(((usage?.total.totalTokens ?? 0) / settings.ai.tokenBudget) * 100))}%</span>
            </div>
            <Progress value={((usage?.total.totalTokens ?? 0) / settings.ai.tokenBudget) * 100} />
          </div>
        </Show>

        <Show if={Boolean(usage) && Object.keys(usage?.byProvider ?? {}).length > 0}>
          <table className="table mt-2">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Calls</th>
                <th>Errors</th>
                <th>Prompt tokens</th>
                <th>Completion tokens</th>
                <th>Last used</th>
              </tr>
            </thead>
            <tbody>{Object.entries(usage?.byProvider ?? {}).map(renderProviderUsageRow)}</tbody>
          </table>
        </Show>

        <Show if={Boolean(providerUsage)}>
          <div className="card card--flat mt-2">
            <div className="row row--between">
              <div>
                <div className="strong">{providerUsage?.title}</div>
                <div className="tiny muted">{providerUsage?.message}</div>
              </div>
              <Badge tone={providerUsage?.supported ? 'success' : 'neutral'}>{providerUsage?.supported ? 'provider-reported' : 'not available'}</Badge>
            </div>
            <Show if={(providerUsage?.rows.length ?? 0) > 0}>
              <div className="col mt-2">{providerUsage?.rows.map(renderProviderUsageReportRow)}</div>
            </Show>
          </div>
        </Show>
      </SectionCard>

      {groups.map(renderProviderGroup)}

      <SectionCard title="How your data is handled">
        <div className="list">
          <div className="list-item">
            <IconCpu size={16} />
            <div className="list-item__main">
              <div className="list-item__title">Prompts run inside the extension</div>
              <div className="list-item__meta">JobPal builds every prompt locally and sends it straight to your provider — there is no middleman server.</div>
            </div>
          </div>
          <div className="list-item">
            <IconShield size={16} />
            <div className="list-item__main">
              <div className="list-item__title">Keys stay in your browser</div>
              <div className="list-item__meta">API keys are stored in chrome.storage.local and are never synced or transmitted anywhere else.</div>
            </div>
          </div>
          <div className="list-item">
            <IconLink size={16} />
            <div className="list-item__main">
              <div className="list-item__title">OAuth 2.0 with PKCE</div>
              <div className="list-item__meta">For providers that support it, sign in through a secure popup. Tokens refresh automatically.</div>
            </div>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
