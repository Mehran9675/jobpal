/**
 * Cooperative cancellation for long AI pipelines.
 * The in-flight provider request finishes, then the pipeline stops at the next
 * checkpoint instead of continuing through every step.
 */
interface Token {
  cancelled: boolean;
  at: number;
}

const tokens = new Map<string, Token>();

export function tokenKeyFor(tabId: number | undefined): string {
  return tabId !== undefined ? `tab:${tabId}` : 'global';
}

export function createToken(key: string): void {
  tokens.set(key, { cancelled: false, at: Date.now() });
}

export function cancelToken(key: string): boolean {
  const token = tokens.get(key);
  if (!token) return false;
  token.cancelled = true;
  return true;
}

export function isCancelled(key: string): boolean {
  return tokens.get(key)?.cancelled ?? false;
}

export function releaseToken(key: string): void {
  tokens.delete(key);
}

export function cancelAll(): void {
  for (const token of tokens.values()) token.cancelled = true;
}
