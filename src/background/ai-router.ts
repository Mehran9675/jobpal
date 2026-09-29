import type { AppSettings, ChatMessage, ChatOptions, ChatResult, Profile, ProviderConnection } from '@/types';
import { chat, refreshOAuthIfNeeded } from '@/lib/ai/client';
import type { ChatRunner, TaskContext } from '@/lib/ai/tasks';
import { getSettings } from '@/lib/storage';
import { aiStatusFor } from '@/lib/ai/status';
import { recordUsage } from '@/lib/ai/usage';
import { AppError, AI_REQUIRED_MESSAGE } from '@/lib/errors';

export function activeConnection(settings: AppSettings): ProviderConnection | null {
  const providerId = settings.ai.activeProviderId;
  if (!providerId) return null;
  const connection = settings.ai.connections[providerId];
  if (!connection) return null;
  return connection;
}

/**
 * Every AI-powered feature goes through this guard. Without an active,
 * credentialed provider JobPaal refuses to run the task instead of silently
 * producing locally generated output.
 */
export function requireAIConnection(settings: AppSettings): { providerId: string; connection: ProviderConnection } {
  const status = aiStatusFor(settings);
  if (!status.ready || !status.providerId) {
    throw new AppError(status.reason ? `${AI_REQUIRED_MESSAGE} (${status.reason})` : AI_REQUIRED_MESSAGE, 'AI_REQUIRED');
  }
  const connection = settings.ai.connections[status.providerId];
  if (!connection) throw new AppError(AI_REQUIRED_MESSAGE, 'AI_REQUIRED');
  return { providerId: status.providerId, connection };
}

export async function chatWithSettings(
  messages: ChatMessage[],
  options: ChatOptions & { providerId?: string; model?: string; allowLocalFallback?: boolean } = {},
): Promise<ChatResult> {
  const settings = await getSettings();
  const providerId = options.providerId ?? settings.ai.activeProviderId;
  if (!providerId) throw new AppError(AI_REQUIRED_MESSAGE, 'AI_REQUIRED');
  let connection = settings.ai.connections[providerId];
  if (!connection) throw new AppError(`Provider "${providerId}" has no saved credentials. Add its API key in the management page.`, 'AI_REQUIRED');

  connection = await refreshOAuthIfNeeded(connection);
  if (connection !== settings.ai.connections[providerId]) {
    const { patchSettings } = await import('@/lib/storage');
    await patchSettings({ ai: { connections: { [providerId]: connection } } });
  }

  try {
    const result = await chat(providerId, messages, {
      ...options,
      model: options.model ?? connection.model,
      temperature: options.temperature ?? settings.ai.temperature,
      maxTokens: options.maxTokens ?? settings.ai.maxTokens,
      connection,
      timeoutMs: settings.ai.timeoutMs,
    });
    await recordUsage(providerId, result);
    if (connection.status !== 'ok' || connection.lastError) {
      const { patchSettings } = await import('@/lib/storage');
      await patchSettings({ ai: { connections: { [providerId]: { ...connection, status: 'ok', lastError: undefined, verifiedAt: Date.now() } } } });
    }
    return result;
  } catch (error) {
    await recordUsage(providerId, undefined, true);
    const message = error instanceof Error ? error.message : String(error);
    const hint = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(connection.baseUrl ?? '')
      ? ` - ${connection.providerId} looks like a local endpoint, check that the server is running.`
      : '';
    const { patchSettings } = await import('@/lib/storage');
    await patchSettings({ ai: { connections: { [providerId]: { ...connection, status: 'error', lastError: `${message}${hint}` } } } });
    throw new AppError(`${message}${hint}`, 'AI_ERROR');
  }
}

export function buildTaskContext(settings: AppSettings, profile: Profile): TaskContext {
  const { providerId } = requireAIConnection(settings);
  const chatRunner: ChatRunner = async ({ messages, json, temperature, maxTokens }) =>
    chatWithSettings(messages, { json, temperature, maxTokens, providerId });

  return {
    config: settings.prompts,
    chat: chatRunner,
    profile,
  };
}
