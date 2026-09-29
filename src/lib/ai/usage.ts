import { storageLocalGet, storageLocalSet } from '@/lib/browser';
import type { ChatResult, UsageRecord, UsageSummary } from '@/types';

const USAGE_KEY = 'jobpal.usage';
const KEEP_DAYS = 62;

function emptyRecord(): UsageRecord {
  return { calls: 0, errors: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

export function emptyUsageSummary(): UsageSummary {
  return { total: emptyRecord(), byProvider: {}, byDay: {}, trackedSince: Date.now() };
}

function dayKey(at = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10);
}

function add(record: UsageRecord, prompt = 0, completion = 0): UsageRecord {
  const promptTokens = record.promptTokens + prompt;
  const completionTokens = record.completionTokens + completion;
  return {
    ...record,
    calls: record.calls + 1,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    lastAt: Date.now(),
  };
}

export async function getUsage(): Promise<UsageSummary> {
  const stored = await storageLocalGet<UsageSummary>([USAGE_KEY]);
  const summary = stored[USAGE_KEY];
  if (!summary) return emptyUsageSummary();
  return { ...emptyUsageSummary(), ...summary };
}

async function persist(summary: UsageSummary): Promise<UsageSummary> {
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const byDay: Record<string, UsageRecord> = {};
  for (const [day, record] of Object.entries(summary.byDay)) {
    if (Date.parse(`${day}T00:00:00Z`) >= cutoff) byDay[day] = record;
  }
  const trimmed: UsageSummary = { ...summary, byDay };
  await storageLocalSet({ [USAGE_KEY]: trimmed });
  return trimmed;
}

export async function recordUsage(providerId: string, result?: ChatResult, error = false): Promise<void> {
  const summary = await getUsage();
  const day = dayKey();
  const prompt = result?.usage?.promptTokens ?? 0;
  const completion = result?.usage?.completionTokens ?? 0;

  const providerRecord = summary.byProvider[providerId] ?? emptyRecord();
  const dayRecord = summary.byDay[day] ?? emptyRecord();

  let nextProvider: UsageRecord;
  let nextDay: UsageRecord;
  if (error) {
    nextProvider = { ...providerRecord, errors: providerRecord.errors + 1, lastAt: Date.now() };
    nextDay = { ...dayRecord, errors: dayRecord.errors + 1, lastAt: Date.now() };
  } else {
    nextProvider = add(providerRecord, prompt, completion);
    nextDay = add(dayRecord, prompt, completion);
  }

  const nextTotal = error ? { ...summary.total, errors: summary.total.errors + 1, lastAt: Date.now() } : add(summary.total, prompt, completion);
  const next: UsageSummary = {
    ...summary,
    total: nextTotal,
    byProvider: { ...summary.byProvider, [providerId]: nextProvider },
    byDay: { ...summary.byDay, [day]: nextDay },
    lastAt: Date.now(),
  };

  await persist(next);
  await maybeWarnBudget(next);
}

/** Warns once when the configured token budget is reached. */
async function maybeWarnBudget(summary: UsageSummary): Promise<void> {
  try {
    const { getSettings } = await import('@/lib/storage');
    const settings = await getSettings();
    const budget = settings.ai.tokenBudget ?? 0;
    if (budget <= 0) return;
    if (summary.total.totalTokens < budget) {
      if (summary.warned) await persist({ ...summary, warned: false });
      return;
    }
    if (summary.warned) return;
    await persist({ ...summary, warned: true });
    const { notify } = await import('@/background/notify');
    await notify(
      'Token budget reached',
      `You have used ${formatTokens(summary.total.totalTokens)} of your ${formatTokens(budget)} token budget. Open JobPal → AI providers to review usage.`,
      'warning',
    );
  } catch {
    /* budget warnings are best effort */
  }
}

export async function resetUsage(): Promise<UsageSummary> {
  const fresh = emptyUsageSummary();
  await storageLocalSet({ [USAGE_KEY]: fresh });
  return fresh;
}

export function todayUsage(summary: UsageSummary): UsageRecord {
  return summary.byDay[dayKey()] ?? emptyRecord();
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}
