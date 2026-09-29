import { useEffect, useMemo, useState } from 'react';
import type { AgentState, AppSettings, ApplicationRecord, UsageSummary } from '@/types';
import { PROVIDER_MAP } from '@/lib/ai/providers';
import { aiStatusFor } from '@/lib/ai/status';
import { formatTokens, todayUsage } from '@/lib/ai/usage';
import { sendMessage } from '@/lib/messaging';
import { Badge, Button, EmptyState, Select, Show, Stat } from '@/ui/components';
import { IconBriefcase, IconCpu, IconFile, IconRobot, IconSparkles, IconPlay, IconPause } from '@/ui/components/Icons';
import { useAgent, useDocuments } from '@/ui/hooks';
import { RecentApplicationRow } from './dashboard/components/RecentApplicationRow';

export function DashboardTab({
  applications,
  settings,
  navigate,
  patchSettings,
}: {
  applications: ApplicationRecord[];
  settings: AppSettings;
  navigate: (tab: string, param?: string) => void;
  patchSettings: (patch: Record<string, unknown>) => Promise<AppSettings>;
}) {
  const { agent, action } = useAgent(5000);
  const { data: documents } = useDocuments();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const status = aiStatusFor(settings);

  useEffect(() => {
    void sendMessage('ai.usage', undefined)
      .then(setUsage)
      .catch(() => undefined);
  }, [settings.ai.activeProviderId, settings.ai.connections]);

  const stats = useMemo(() => {
    const byStatus = (statusId: string) => applications.filter((application) => application.status === statusId).length;
    const scores = applications.map((application) => application.matchScore ?? 0).filter((score) => score > 0);
    return {
      total: applications.length,
      applied: byStatus('applied') + byStatus('screening') + byStatus('interview') + byStatus('technical') + byStatus('offer'),
      interviews: byStatus('interview') + byStatus('technical'),
      offers: byStatus('offer'),
      ready: byStatus('ready'),
      rejected: byStatus('rejected'),
      avgScore: scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
      documents: (documents ?? []).length,
    };
  }, [applications, documents]);

  const connection = status.providerId ? settings.ai.connections[status.providerId] : undefined;
  const providerDef = status.providerId ? PROVIDER_MAP[status.providerId] : undefined;
  const today = usage ? todayUsage(usage) : null;
  const modelChoices = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; label: string }[] = [];
    for (const model of [...(connection?.models ?? []), ...(providerDef?.models ?? [])]) {
      if (model.id && !seen.has(model.id)) {
        seen.add(model.id);
        out.push({ id: model.id, label: model.label || model.id });
      }
    }
    const current = connection?.model || providerDef?.defaultModel;
    if (current && !seen.has(current)) out.unshift({ id: current, label: `${current} (current)` });
    return out;
  }, [connection, providerDef]);

  const renderModelChoice = (model: { id: string; label: string }) => (
    <option key={model.id} value={model.id}>
      {model.label}
    </option>
  );

  const renderLogEntry = (entry: AgentState['log'][number], index: number) => (
    <div key={index} className={`log-view__row log-view__row--${entry.level}`}>
      <span className="log-view__time">{new Date(entry.at).toLocaleTimeString()}</span>
      <span>{entry.message}</span>
    </div>
  );

  const renderAgentToggleIcon = (paused: boolean) => (
    <>
      <Show if={paused}>
        <IconPlay size={13} />
      </Show>
      <Show if={!paused}>
        <IconPause size={13} />
      </Show>
    </>
  );

  const renderApplication = (application: ApplicationRecord) => (
    <RecentApplicationRow key={application.id} application={application} onOpen={() => navigate('applications', application.id)} />
  );

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">Dashboard</h1>
          <p className="main__subtitle">
            Your application pipeline at a glance. JobPaal tailors every document to the posting, then either fills the form for you or applies on your behalf.
          </p>
        </div>
        <div className="row">
          <Button variant="outline" icon={<IconFile size={15} />} onClick={() => navigate('documents')}>
            Documents
          </Button>
          <Button variant="primary" icon={<IconSparkles size={15} />} onClick={() => navigate('profile')}>
            Update profile
          </Button>
        </div>
      </header>

      <div className="grid grid--4 mb-2">
        <Stat value={stats.total} label="Applications tracked" />
        <Stat value={stats.interviews} label="Interviews" />
        <Stat value={stats.offers} label="Offers" />
        <Stat value={stats.documents} label="Documents generated" />
      </div>

      <div className="grid grid--2">
        <section className="panel">
          <div className="panel__title">
            <IconCpu size={16} /> AI provider
          </div>
          <div className="panel__hint">
            All prompting happens inside the extension. Every AI-powered feature stays disabled until a provider is connected and active.
          </div>
          <Show if={status.ready}>
            <div className="row row--between">
              <div>
                <div className="strong">{status.providerName}</div>
                <div className="tiny muted">
                  {today ? `${today.calls} call${today.calls === 1 ? '' : 's'} today · ${formatTokens(today.totalTokens)} tokens` : `temperature ${settings.ai.temperature} · max ${settings.ai.maxTokens} tokens`}
                </div>
              </div>
              <Badge tone={connection?.status === 'error' ? 'warning' : 'success'}>{connection?.status === 'error' ? 'connected · last call failed' : 'connected'}</Badge>
            </div>
            <Show if={modelChoices.length > 0}>
              <div className="mt-2" style={{ maxWidth: 380 }}>
                <Select
                  value={connection?.model ?? providerDef?.defaultModel ?? ''}
                  onChange={(event) => {
                    const providerId = status.providerId;
                    if (!providerId) return;
                    const existing = connection ?? { providerId, status: 'untested' as const };
                    void patchSettings({ ai: { connections: { [providerId]: { ...existing, model: event.target.value } } } });
                  }}
                >
                  {modelChoices.map(renderModelChoice)}
                </Select>
              </div>
            </Show>
          </Show>
          <Show if={!status.ready}>
            <div className="row row--between">
              <div>
                <div className="strong">No AI connected</div>
                <div className="tiny muted">{status.reason ?? 'Connect a provider to enable resume parsing, tailoring, cover letters and answers.'}</div>
              </div>
              <Button size="sm" variant="primary" onClick={() => navigate('ai')}>
                Connect
              </Button>
            </div>
          </Show>
          <div className="divider" />
          <div className="row">
            <Button size="sm" variant="outline" onClick={() => navigate('ai')}>
              Manage providers
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate('prompts')}>
              Prompts & style
            </Button>
            <Show if={Boolean(usage)}>
              <span className="tiny muted">
                {usage?.total.calls} calls · {formatTokens(usage?.total.totalTokens ?? 0)} tokens all-time
              </span>
            </Show>
          </div>
        </section>

        <section className="panel">
          <div className="panel__title">
            <IconRobot size={16} /> Agent
          </div>
          <div className="panel__hint">
            Let JobPaal work through your queue in the background. The agent needs an active AI connection; rules decide what to skip and when it may submit.
          </div>
          <Show if={!status.ready}>
            <div className="card card--flat mb-2">
              <div className="row row--between">
                <span className="small muted">The agent is disabled until an AI provider is connected.</span>
                <Button size="sm" variant="primary" onClick={() => navigate('ai')}>
                  Connect AI
                </Button>
              </div>
            </div>
          </Show>
          <div className="row row--between">
            <div>
              <div className="strong">{agent?.running ? (agent.paused ? 'Paused' : 'Running') : 'Stopped'}</div>
              <div className="tiny muted">
                {agent
                  ? `${agent.queue.filter((item) => item.status === 'queued').length} queued · ${agent.appliedToday}/${settings.automation.dailyLimit} today · ${agent.stats.applied} applied all-time`
                  : 'Loading agent state…'}
              </div>
            </div>
            <Show if={Boolean(agent?.running)}>
              <div className="row">
                <Button size="sm" variant="outline" icon={renderAgentToggleIcon(Boolean(agent?.paused))} onClick={() => void action(agent?.paused ? 'agent.resume' : 'agent.pause')}>
                  {agent?.paused ? 'Resume' : 'Pause'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => void action('agent.stop')}>
                  Stop
                </Button>
              </div>
            </Show>
            <Show if={!agent?.running}>
              <Button
                size="sm"
                variant="primary"
                icon={<IconPlay size={13} />}
                disabled={!status.ready}
                title={status.ready ? 'Start the agent' : 'Connect an AI provider first'}
                onClick={() =>
                  void action('agent.start')
                    .then(() => undefined)
                    .catch((error) => console.warn('[jobpaal] could not start agent:', error))
                }
              >
                Start
              </Button>
            </Show>
          </div>
          <Show if={(agent?.log ?? []).length > 0}>
            <div className="divider" />
            <div className="log-view">{agent?.log.slice(0, 6).map(renderLogEntry)}</div>
          </Show>
          <div className="divider" />
          <Button size="sm" variant="ghost" onClick={() => navigate('automation')}>
            Automation rules
          </Button>
        </section>
      </div>

      <section className="panel">
        <div className="row row--between">
          <div className="panel__title">
            <IconBriefcase size={16} /> Recent applications
          </div>
          <Button size="sm" variant="ghost" onClick={() => navigate('applications')}>
            View all
          </Button>
        </div>
        <Show if={applications.length === 0}>
          <EmptyState
            icon="◈"
            title="No applications yet"
            text="Open a job posting in your browser and use the JobPaal overlay or popup to tailor your first set of documents."
          />
        </Show>
        <Show if={applications.length > 0}>
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Company</th>
                <th>Status</th>
                <th>Match</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>{applications.slice(0, 6).map(renderApplication)}</tbody>
          </table>
        </Show>
      </section>
    </>
  );
}
