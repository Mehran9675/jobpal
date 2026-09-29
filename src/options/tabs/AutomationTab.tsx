import { useState } from 'react';
import type { AgentQueueItem, AgentState, AppSettings, RuleDef } from '@/types';
import { CURATED_RULES } from '@/lib/defaults';
import { errorMessage, sendMessage } from '@/lib/messaging';
import { Button, EmptyState, Field, Input, SectionCard, Show, Toggle } from '@/ui/components';
import { IconPlay, IconPause, IconRobot, IconShield, IconTrash, IconRefresh } from '@/ui/components/Icons';
import { useAgent } from '@/ui/hooks';
import { useToast } from '@/ui/components/Toast';
import { aiStatusFor } from '@/lib/ai/status';
import { CuratedRuleRow } from './automation/components/CuratedRuleRow';
import { QueueItemRow } from './automation/components/QueueItemRow';
import { WEEK_DAYS } from './automation/constants';

export function AutomationTab({
  settings,
  patchSettings,
  navigate,
}: {
  settings: AppSettings;
  patchSettings: (patch: Record<string, unknown>) => Promise<AppSettings>;
  navigate: (tab: string, param?: string) => void;
}) {
  const toast = useToast();
  const automation = settings.automation;
  const { agent, action, reload } = useAgent(4000);
  const [domainInput, setDomainInput] = useState('');
  const [allowInput, setAllowInput] = useState('');

  const patchAutomation = (patch: Partial<AppSettings['automation']>) => patchSettings({ automation: { ...automation, ...patch } });
  const ai = aiStatusFor(settings);

  const setRule = (id: string, enabled: boolean, value?: number) =>
    void patchAutomation({ rules: { ...automation.rules, [id]: { ...automation.rules[id], enabled, value: value ?? automation.rules[id]?.value } } });

  const renderAgentToggleIcon = (paused: boolean) => (
    <>
      <Show if={paused}>
        <IconPlay size={15} />
      </Show>
      <Show if={!paused}>
        <IconPause size={15} />
      </Show>
    </>
  );

  const renderDayToggle = (day: string, index: number) => {
    const active = automation.workingHours.days.includes(index);
    return (
      <button
        key={day}
        className={`btn btn--sm ${active ? 'btn--primary' : 'btn--outline'}`}
        onClick={() =>
          void patchAutomation({
            workingHours: {
              ...automation.workingHours,
              days: active ? automation.workingHours.days.filter((entry) => entry !== index) : [...automation.workingHours.days, index],
            },
          })
        }
      >
        {day}
      </button>
    );
  };

  const renderCuratedRule = (rule: RuleDef) => {
    const state = automation.rules[rule.id] ?? { enabled: rule.defaultEnabled };
    return <CuratedRuleRow key={rule.id} rule={rule} state={state} onSetRule={setRule} />;
  };

  const renderNeverSubmitDomain = (domain: string) => (
    <span className="chip" key={domain}>
      <IconShield size={11} /> {domain}
      <button onClick={() => void patchAutomation({ neverSubmitDomains: automation.neverSubmitDomains.filter((entry) => entry !== domain) })}>
        <IconTrash size={11} />
      </button>
    </span>
  );

  const renderAllowlistDomain = (domain: string) => (
    <span className="chip" key={domain}>
      {domain}
      <button onClick={() => void patchAutomation({ allowlist: automation.allowlist.filter((entry) => entry !== domain) })}>
        <IconTrash size={11} />
      </button>
    </span>
  );

  const retryQueueItem = (item: AgentQueueItem) => {
    void sendMessage('agent.retry', { id: item.id })
      .then(() => {
        toast.push('Job queued again.');
        void reload();
      })
      .catch((error) => toast.error(errorMessage(error)));
  };

  const removeQueueItem = (item: AgentQueueItem) => {
    void sendMessage('agent.removeItem', { id: item.id }).then(() => void reload());
  };

  const renderQueueItem = (item: AgentQueueItem) => <QueueItemRow key={item.id} item={item} onRetry={retryQueueItem} onRemove={removeQueueItem} />;

  const renderLogEntry = (entry: AgentState['log'][number], index: number) => (
    <div key={index} className={`log-view__row log-view__row--${entry.level}`}>
      <span className="log-view__time">{new Date(entry.at).toLocaleString()}</span>
      <span>{entry.message}</span>
    </div>
  );

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">Automation</h1>
          <p className="main__subtitle">
            The agent works through your queue in the background: reading postings, tailoring documents, filling forms and — if you allow it — submitting for
            you. Every rule below is a safety gate.
          </p>
        </div>
        <div className="row">
          <Show if={Boolean(agent?.running)}>
            <Button variant="outline" icon={renderAgentToggleIcon(Boolean(agent?.paused))} onClick={() => void action(agent?.paused ? 'agent.resume' : 'agent.pause')}>
              {agent?.paused ? 'Resume agent' : 'Pause agent'}
            </Button>
            <Button variant="danger" onClick={() => void action('agent.stop')}>
              Stop agent
            </Button>
          </Show>
          <Show if={!agent?.running}>
            <Button
              variant="primary"
              icon={<IconPlay size={15} />}
              disabled={!ai.ready}
              title={ai.ready ? 'Start the agent' : `Connect an AI provider first — ${ai.reason ?? ''}`}
              onClick={() =>
                void action('agent.start')
                  .then(() => toast.success('Agent started.'))
                  .catch((error) => toast.error(errorMessage(error)))
              }
            >
              Start agent
            </Button>
          </Show>
        </div>
      </header>

      <Show if={!ai.ready}>
        <div className="panel" style={{ borderColor: 'var(--warning)' }}>
          <div className="row row--between">
            <div>
              <div className="panel__title">AI required for the agent</div>
              <div className="panel__hint mb-1">
                {ai.reason ?? 'No AI provider is connected.'} The agent reads postings, writes documents and answers questions with AI, so starting it is disabled
                until a provider is active.
              </div>
            </div>
            <Button variant="primary" onClick={() => navigate('ai')}>
              Connect AI
            </Button>
          </div>
        </div>
      </Show>

      <div className="grid grid--2">
        <SectionCard title="Agent control" hint="Queue jobs from any job page with the “Queue” button, or let JobPal collect them from search pages.">
          <div className="row row--between mb-2">
            <div className="row">
              <span className={`agent-strip__dot ${agent?.running ? (agent.paused ? 'paused' : 'running') : ''}`} />
              <div>
                <div className="strong">{agent?.running ? (agent.paused ? 'Paused' : 'Running') : 'Stopped'}</div>
                <div className="tiny muted">
                  {agent
                    ? `${agent.queue.filter((item) => item.status === 'queued').length} queued · ${agent.appliedToday}/${automation.dailyLimit} today · ${agent.stats.applied} applied · ${agent.stats.skipped} skipped · ${agent.stats.needsAttention} waiting on you`
                    : 'Loading…'}
                </div>
              </div>
            </div>
            <Button size="sm" variant="ghost" icon={<IconRefresh size={13} />} onClick={() => void reload()} />
          </div>
          <div className="grid grid--2">
            <Field label="Mode" hint="Assist fills forms for review. Auto may submit when your rules allow.">
              <select className="select" value={automation.mode} onChange={(event) => void patchAutomation({ mode: event.target.value as 'assist' | 'auto' })}>
                <option value="assist">Assist — always review</option>
                <option value="auto">Auto — submit when allowed</option>
              </select>
            </Field>
            <Field label="Daily application limit">
              <Input type="number" min={1} value={automation.dailyLimit} onChange={(event) => void patchAutomation({ dailyLimit: Number(event.target.value) })} />
            </Field>
            <Field label="Min delay between actions (s)">
              <Input type="number" min={1} value={automation.minDelaySeconds} onChange={(event) => void patchAutomation({ minDelaySeconds: Number(event.target.value) })} />
            </Field>
            <Field label="Max delay (s)">
              <Input type="number" min={1} value={automation.maxDelaySeconds} onChange={(event) => void patchAutomation({ maxDelaySeconds: Number(event.target.value) })} />
            </Field>
            <Field label="Match threshold (%)">
              <Input type="number" min={0} max={100} value={automation.matchThreshold} onChange={(event) => void patchAutomation({ matchThreshold: Number(event.target.value) })} />
            </Field>
            <Field label="Fill confidence needed to submit (%)">
              <Input
                type="number"
                min={0}
                max={100}
                value={Math.round(automation.minConfidenceToSubmit * 100)}
                onChange={(event) => void patchAutomation({ minConfidenceToSubmit: Number(event.target.value) / 100 })}
              />
            </Field>
          </div>
          <Toggle checked={automation.enabled} onChange={(enabled) => void patchAutomation({ enabled })} label="Automation enabled" hint="Master switch for the agent." />
          <div className="mt-2">
            <Toggle
              checked={automation.autoSubmit}
              onChange={(autoSubmit) => void patchAutomation({ autoSubmit })}
              label="Allow automatic submission"
              hint="Only applies in Auto mode, when every rule passes and form-fill confidence is high enough."
            />
          </div>
        </SectionCard>

        <SectionCard title="Working hours" hint="The agent only works inside these hours.">
          <Toggle
            checked={automation.workingHours.enabled}
            onChange={(enabled) => void patchAutomation({ workingHours: { ...automation.workingHours, enabled } })}
            label="Restrict to working hours"
          />
          <div className="grid grid--2 mt-2">
            <Field label="Start hour (0-23)">
              <Input
                type="number"
                min={0}
                max={23}
                value={automation.workingHours.start}
                onChange={(event) => void patchAutomation({ workingHours: { ...automation.workingHours, start: Number(event.target.value) } })}
              />
            </Field>
            <Field label="End hour (0-23)">
              <Input
                type="number"
                min={0}
                max={23}
                value={automation.workingHours.end}
                onChange={(event) => void patchAutomation({ workingHours: { ...automation.workingHours, end: Number(event.target.value) } })}
              />
            </Field>
          </div>
          <Field label="Days">
            <div className="row row--wrap">{WEEK_DAYS.map(renderDayToggle)}</div>
          </Field>
          <Field label="Hunt keywords" hint="Used when scanning search pages for jobs to queue.">
            <Input value={automation.huntKeywords} placeholder="senior backend engineer, platform engineer" onChange={(event) => void patchAutomation({ huntKeywords: event.target.value })} />
          </Field>
          <Field label="Preferred locations">
            <Input value={automation.huntLocations} placeholder="Remote, Berlin, London" onChange={(event) => void patchAutomation({ huntLocations: event.target.value })} />
          </Field>
          <Toggle checked={automation.huntEnabled} onChange={(huntEnabled) => void patchAutomation({ huntEnabled })} label="Scan job-search pages for matches" />
        </SectionCard>
      </div>

      <SectionCard title="Curated rules" hint="Toggle the behaviours you want. These are the guardrails the agent checks before it acts.">
        <div className="col">{CURATED_RULES.map(renderCuratedRule)}</div>
      </SectionCard>

      <div className="grid grid--2">
        <SectionCard title="Domain safety" hint="The agent will never submit on blocked domains. Allowlisting restricts it to specific sites.">
          <Field label="Never submit on these domains">
            <div className="row mb-1">
              <Input
                value={domainInput}
                placeholder="example.com"
                onChange={(event) => setDomainInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && domainInput.trim()) {
                    void patchAutomation({ neverSubmitDomains: [...automation.neverSubmitDomains, domainInput.trim()] });
                    setDomainInput('');
                  }
                }}
              />
            </div>
            <div className="chips">{automation.neverSubmitDomains.map(renderNeverSubmitDomain)}</div>
          </Field>
          <div className="divider" />
          <Toggle checked={automation.allowlistEnabled} onChange={(allowlistEnabled) => void patchAutomation({ allowlistEnabled })} label="Only apply on allowlisted domains" />
          <div className="row mt-2 mb-1">
            <Input
              value={allowInput}
              placeholder="boards.greenhouse.io"
              onChange={(event) => setAllowInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && allowInput.trim()) {
                  void patchAutomation({ allowlist: [...automation.allowlist, allowInput.trim()] });
                  setAllowInput('');
                }
              }}
            />
          </div>
          <div className="chips">{automation.allowlist.map(renderAllowlistDomain)}</div>
        </SectionCard>

        <SectionCard title="Queue" hint="Jobs waiting for the agent. Failed jobs pause the agent — retry when you are ready." action={<Button size="sm" variant="ghost" onClick={() => void action('agent.clearQueue')}>Clear</Button>}>
          <Show if={(agent?.queue ?? []).length === 0}>
            <EmptyState icon={<IconRobot size={20} />} title="Queue is empty" text="Open a job posting and press “Queue” in the JobPal popup or overlay." />
          </Show>
          <Show if={(agent?.queue ?? []).length > 0}>
            <div className="list">{agent?.queue.slice(0, 12).map(renderQueueItem)}</div>
          </Show>
        </SectionCard>
      </div>

      <SectionCard title="Agent log" hint="A rolling record of what the agent did.">
        <Show if={(agent?.log ?? []).length === 0}>
          <EmptyState title="Nothing logged yet" text="Start the agent or queue a job to see activity here." />
        </Show>
        <Show if={(agent?.log ?? []).length > 0}>
          <div className="log-view">{agent?.log.map(renderLogEntry)}</div>
        </Show>
      </SectionCard>

      <SectionCard title="Apply to this page now" hint="Use the JobPal overlay or popup on any job page for a one-off application outside the queue.">
        <Button variant="outline" onClick={() => navigate('dashboard')}>
          Back to dashboard
        </Button>
      </SectionCard>
    </>
  );
}
