import type { ProviderConnection, ProviderUsageReport } from '@/types';
import { PROVIDER_MAP } from './providers';

function authHeaders(connection: ProviderConnection): Record<string, string> {
  const def = PROVIDER_MAP[connection.providerId];
  const key = connection.apiKey?.trim();
  const headers: Record<string, string> = {};
  if (def?.auth === 'api-key-header' && key) headers[def.authHeader ?? 'x-api-key'] = key;
  else if (key) headers.Authorization = `Bearer ${key}`;
  else if (connection.oauth?.accessToken) headers.Authorization = `Bearer ${connection.oauth.accessToken}`;
  if (def?.extraHeaders) Object.assign(headers, def.extraHeaders);
  return headers;
}

function base(connection: ProviderConnection): string {
  return (connection.baseUrl || PROVIDER_MAP[connection.providerId]?.baseUrl || '').replace(/\/+$/, '');
}

async function tryJson(url: string, connection: ProviderConnection, timeoutMs = 15000): Promise<{ ok: boolean; status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { ...authHeaders(connection), Accept: 'application/json' }, signal: controller.signal });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function money(value: unknown, currency = 'USD'): string | null {
  const n = num(value);
  if (n === null) return null;
  return `${currency} ${n.toFixed(n < 1 ? 4 : 2)}`;
}

/**
 * Queries the provider's own usage/billing endpoints where they exist.
 * Providers without such an API fall back to JobPal's locally counted usage.
 */
export async function fetchProviderUsage(connection: ProviderConnection): Promise<ProviderUsageReport> {
  const providerId = connection.providerId;
  const root = base(connection);

  if (providerId === 'openrouter') {
    const { ok, body } = await tryJson(`${root}/key`, connection);
    if (ok && body && typeof body === 'object') {
      const data = (body as { data?: Record<string, unknown> }).data ?? (body as Record<string, unknown>);
      const rows: { label: string; value: string }[] = [];
      const usage = money(data.usage);
      const limit = money(data.limit);
      const remaining = money(data.limit_remaining);
      if (usage) rows.push({ label: 'Credits used', value: usage });
      if (limit) rows.push({ label: 'Credit limit', value: limit });
      if (remaining) rows.push({ label: 'Credits remaining', value: remaining });
      if (typeof data.label === 'string') rows.push({ label: 'Key label', value: data.label });
      if (typeof data.is_free_tier === 'boolean') rows.push({ label: 'Free tier', value: data.is_free_tier ? 'Yes' : 'No' });
      return { supported: true, title: 'OpenRouter account usage', message: 'Reported live by the OpenRouter API for your API key.', rows };
    }
  }

  if (providerId === 'deepseek') {
    const origin = new URL(root).origin;
    const { ok, body } = await tryJson(`${origin}/user/balance`, connection);
    if (ok && body && typeof body === 'object') {
      const record = body as { is_available?: boolean; balance_infos?: { currency?: string; total_balance?: string; granted_balance?: string; topped_up_balance?: string }[] };
      const rows = (record.balance_infos ?? []).map((info) => ({
        label: `Balance (${info.currency ?? 'currency'})`,
        value: info.total_balance ?? '-',
      }));
      if (typeof record.is_available === 'boolean') rows.unshift({ label: 'Account available', value: record.is_available ? 'Yes' : 'No' });
      return { supported: true, title: 'DeepSeek balance', message: 'Reported live by the DeepSeek API.', rows };
    }
  }

  if (providerId === 'openai') {
    const end = Math.floor(Date.now() / 1000);
    const start = end - 30 * 24 * 60 * 60;
    const { ok, status, body } = await tryJson(`${root}/organization/costs?start_time=${start}&end_time=${end}&bucket_width=1d`, connection);
    if (ok && body) {
      const data = (body as { data?: { results?: { amount?: { value?: number; currency?: string } }[] }[] }).data ?? [];
      const total = data.flatMap((bucket) => bucket.results ?? []).reduce((sum, result) => sum + (result.amount?.value ?? 0), 0);
      return {
        supported: true,
        title: 'OpenAI organisation costs (30 days)',
        message: 'Requires an organisation admin key. Reported live by the OpenAI API.',
        rows: [{ label: 'Spend', value: `USD ${total.toFixed(2)}` }],
      };
    }
    if (status === 401 || status === 403) {
      return {
        supported: false,
        title: 'OpenAI usage',
        message: 'The OpenAI organisation usage endpoint requires an admin key. JobPal’s local counters are shown instead.',
        rows: [],
      };
    }
  }

  for (const path of ['/user/balance', '/key', '/dashboard/billing/usage', '/usage']) {
    const { ok, status, body } = await tryJson(`${root}${path}`, connection);
    if (ok && body && typeof body === 'object') {
      const rows: { label: string; value: string }[] = [];
      const flat = JSON.stringify(body);
      if (flat.length < 2000) {
        for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
          if (typeof value === 'number' || typeof value === 'string') rows.push({ label: key, value: String(value) });
          if (rows.length >= 8) break;
        }
      }
      if (rows.length > 0) {
        return { supported: true, title: 'Provider-reported usage', message: `Read from ${path}.`, rows };
      }
    }
    if (status === 401 || status === 403 || status === 404) break;
  }

  return {
    supported: false,
    title: 'Account usage not available',
    message:
      'This provider does not expose an account-usage API. JobPal still counts every call and the token usage reported by the model itself.',
    rows: [],
  };
}
