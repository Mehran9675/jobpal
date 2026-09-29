import { PROVIDER_MAP, getProvider } from './providers';
import type { ChatMessage, ChatOptions, ChatResult, ProviderConnection, ProviderDef, ProviderModel } from '@/types';

export interface ResolvedProvider {
  def: ProviderDef;
  connection: ProviderConnection;
  baseUrl: string;
  model: string;
}

export class AIError extends Error {
  constructor(message: string, readonly status?: number, readonly providerId?: string) {
    super(message);
    this.name = 'AIError';
  }
}

export function resolveProvider(providerId: string, connection?: ProviderConnection): ResolvedProvider {
  const def = getProvider(providerId);
  if (!def) throw new AIError(`Unknown AI provider "${providerId}"`);
  const conn = connection ?? { providerId, status: 'untested' as const };
  const baseUrl = (conn.baseUrl || def.baseUrl).replace(/\/+$/, '');
  const model = conn.model || def.defaultModel;
  return { def, connection: conn, baseUrl, model };
}

function buildHeaders(resolved: ResolvedProvider, json = true): Record<string, string> {
  const { def, connection } = resolved;
  const headers: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {};
  const key = connection.apiKey?.trim();
  switch (def.auth) {
    case 'api-key-bearer':
      if (key) headers.Authorization = `Bearer ${key}`;
      break;
    case 'api-key-header':
      if (key) headers[def.authHeader ?? 'x-api-key'] = key;
      break;
    case 'oauth2': {
      const token = connection.oauth?.accessToken;
      if (token) headers.Authorization = `Bearer ${token}`;
      break;
    }
    case 'api-key-query':
    case 'none':
    default:
      break;
  }
  if (def.apiVersion && def.kind === 'anthropic') headers['anthropic-version'] = def.apiVersion;
  if (def.extraHeaders) Object.assign(headers, def.extraHeaders);
  if (connection.extraHeaders) Object.assign(headers, connection.extraHeaders);
  return headers;
}

function withQuery(url: string, params: Record<string, string | undefined>): string {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}

function applyQueryAuth(resolved: ResolvedProvider, url: string): string {
  const { def, connection } = resolved;
  if (def.auth === 'api-key-query' && connection.apiKey) {
    return withQuery(url, { [def.authQueryParam ?? 'key']: connection.apiKey });
  }
  if (def.apiVersion) return withQuery(url, { 'api-version': def.apiVersion });
  return url;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<{ status: number; body: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: response.status, body, text };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AIError(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new AIError(
      message.includes('Failed to fetch')
        ? `Could not reach the provider (${message}). Check the base URL, your connection, or CORS support.`
        : message,
    );
  } finally {
    clearTimeout(timer);
  }
}

function extractError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const err = record.error;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const nested = err as Record<string, unknown>;
      if (typeof nested.message === 'string') return nested.message;
    }
    if (typeof record.message === 'string') return record.message;
    if (Array.isArray(record.detail) && record.detail.length > 0) {
      const first = record.detail[0] as Record<string, unknown>;
      if (typeof first.msg === 'string') return first.msg;
    }
  }
  return `Provider returned HTTP ${status}`;
}

function extractText(resolved: ResolvedProvider, body: unknown): string {
  const data = body as Record<string, never>;
  switch (resolved.def.kind) {
    case 'anthropic': {
      const content = (data?.content ?? []) as { type: string; text?: string }[];
      return content
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n')
        .trim();
    }
    case 'gemini': {
      const candidates = (data?.candidates ?? []) as { content?: { parts?: { text?: string }[] } }[];
      return (candidates[0]?.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('')
        .trim();
    }
    case 'cohere': {
      const message = data?.message as { content?: { type?: string; text?: string }[] } | undefined;
      return (message?.content ?? [])
        .map((part) => part.text ?? '')
        .join('')
        .trim();
    }
    default: {
      const choices = (data?.choices ?? []) as { message?: { content?: string } }[];
      return (choices[0]?.message?.content ?? '').trim();
    }
  }
}

function extractUsage(resolved: ResolvedProvider, body: unknown): ChatResult['usage'] {
  const data = body as Record<string, Record<string, number>>;
  if (resolved.def.kind === 'anthropic') {
    return { promptTokens: data?.usage?.input_tokens, completionTokens: data?.usage?.output_tokens };
  }
  if (resolved.def.kind === 'gemini') {
    return { promptTokens: data?.usageMetadata?.promptTokenCount, completionTokens: data?.usageMetadata?.candidatesTokenCount };
  }
  return { promptTokens: data?.usage?.prompt_tokens, completionTokens: data?.usage?.completion_tokens };
}

function buildRequest(resolved: ResolvedProvider, messages: ChatMessage[], options: ChatOptions): { url: string; init: RequestInit } {
  const { def, baseUrl, model } = resolved;
  const headers = buildHeaders(resolved);

  switch (def.kind) {
    case 'anthropic': {
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const rest = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
      const body = {
        model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.4,
        system: system || undefined,
        messages: rest.length > 0 ? rest : [{ role: 'user', content: 'Hello' }],
      };
      return { url: `${baseUrl}${def.pathOverrides?.chat ?? '/messages'}`, init: { method: 'POST', headers, body: JSON.stringify(body) } };
    }
    case 'gemini': {
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const body = {
        contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }],
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: {
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: options.maxTokens ?? 8192,
          responseMimeType: options.json ? 'application/json' : undefined,
        },
      };
      const url = applyQueryAuth(resolved, `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`);
      return { url, init: { method: 'POST', headers, body: JSON.stringify(body) } };
    }
    case 'cohere': {
      const body = {
        model,
        messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens,
        response_format: options.json ? { type: 'json_object' } : undefined,
      };
      return { url: `${baseUrl}${def.pathOverrides?.chat ?? '/chat'}`, init: { method: 'POST', headers, body: JSON.stringify(body) } };
    }
    default: {
      const body = {
        model,
        messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens,
        stream: false,
        response_format: options.json && def.supportsJsonMode ? { type: 'json_object' } : undefined,
      };
      let url = `${baseUrl}${def.pathOverrides?.chat ?? '/chat/completions'}`;
      url = applyQueryAuth(resolved, url);
      return { url, init: { method: 'POST', headers, body: JSON.stringify(body) } };
    }
  }
}

export async function chat(
  providerId: string,
  messages: ChatMessage[],
  options: ChatOptions & { connection?: ProviderConnection; timeoutMs?: number } = {},
): Promise<ChatResult> {
  const resolved = resolveProvider(providerId, options.connection);
  const timeoutMs = options.timeoutMs ?? 90000;
  const { url, init } = buildRequest(resolved, messages, options);
  let result = await fetchJson(url, init, timeoutMs);

  if (result.status >= 400 && options.json && resolved.def.supportsJsonMode) {
    const retry = buildRequest(resolved, messages, { ...options, json: false });
    const retryResult = await fetchJson(retry.url, retry.init, timeoutMs);
    if (retryResult.status < 400) result = retryResult;
  }

  if (result.status >= 400) {
    throw new AIError(extractError(result.body, result.status), result.status, providerId);
  }

  const text = extractText(resolved, result.body);
  if (!text) {
    throw new AIError('The provider returned an empty response.', result.status, providerId);
  }
  return { text, model: resolved.model, providerId, usage: extractUsage(resolved, result.body) };
}

export async function listModels(connection: ProviderConnection): Promise<ProviderModel[]> {
  const resolved = resolveProvider(connection.providerId, connection);
  const { def, baseUrl } = resolved;
  const headers = buildHeaders(resolved, false);
  const candidates: { url: string; pick: (body: unknown) => ProviderModel[] }[] = [];

  if (def.kind === 'openai' || def.kind === 'anthropic') {
    candidates.push({
      url: `${baseUrl}${def.pathOverrides?.models ?? '/models'}`,
      pick: (body) => {
        const data = (body as { data?: { id?: string }[] })?.data ?? [];
        return data
          .filter((model) => typeof model.id === 'string')
          .map((model) => ({ id: model.id as string, label: model.id as string }))
          .sort((a, b) => a.id.localeCompare(b.id));
      },
    });
  }
  if (def.kind === 'gemini') {
    candidates.push({
      url: applyQueryAuth(resolved, `${baseUrl}/models`),
      pick: (body) => {
        const models = (body as { models?: { name?: string; displayName?: string }[] })?.models ?? [];
        return models
          .map((model) => ({
            id: (model.name ?? '').replace(/^models\//, ''),
            label: model.displayName ?? (model.name ?? '').replace(/^models\//, ''),
          }))
          .filter((model) => model.id);
      },
    });
  }
  if (def.kind === 'cohere') {
    candidates.push({
      url: `${baseUrl}/models`,
      pick: (body) => {
        const models = (body as { models?: { name?: string }[] })?.models ?? [];
        return models.filter((m) => m.name).map((m) => ({ id: m.name as string, label: m.name as string }));
      },
    });
  }

  for (const candidate of candidates) {
    try {
      const result = await fetchJson(candidate.url, { method: 'GET', headers }, 15000);
      if (result.status < 400) {
        const models = candidate.pick(result.body);
        if (models.length > 0) return models;
      }
    } catch {
      /* fall through */
    }
  }
  return def.models;
}

export async function testConnection(connection: ProviderConnection, timeoutMs = 30000): Promise<{ ok: boolean; message: string; model?: string }> {
  try {
    const models = await listModels(connection);
    const result = await chat(
      connection.providerId,
      [{ role: 'user', content: 'Reply with exactly one word: pong' }],
      { maxTokens: 12, temperature: 0, connection, timeoutMs },
    );
    const preview = result.text.slice(0, 60).replace(/\s+/g, ' ');
    const count = models.length;
    return {
      ok: true,
      message: count > 1 ? `Connected. ${count} models available. Reply: “${preview}”` : `Connected. Reply: “${preview}”`,
      model: result.model,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function refreshOAuthIfNeeded(connection: ProviderConnection): Promise<ProviderConnection> {
  const def = PROVIDER_MAP[connection.providerId];
  const oauth = connection.oauth;
  if (!def?.oauth || !oauth) return connection;
  const expiresAt = oauth.expiresAt ?? 0;
  if (expiresAt > Date.now() + 60_000 || !oauth.refreshToken) return connection;
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: oauth.refreshToken,
      client_id: def.oauth.clientId ?? '',
    });
    const response = await fetch(def.oauth.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) return connection;
    const json = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!json.access_token) return connection;
    return {
      ...connection,
      oauth: {
        accessToken: json.access_token,
        refreshToken: json.refresh_token ?? oauth.refreshToken,
        expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
        tokenType: 'Bearer',
      },
    };
  } catch {
    return connection;
  }
}
