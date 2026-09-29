import type { UsageRecord } from '@/types';
import { PROVIDER_MAP } from '@/lib/ai/providers';
import { formatTokens } from '@/lib/ai/usage';

export function ProviderUsageRow({ providerId, record }: { providerId: string; record: UsageRecord }) {
  return (
    <tr>
      <td>{PROVIDER_MAP[providerId]?.name ?? providerId}</td>
      <td>{record.calls}</td>
      <td>{record.errors}</td>
      <td>{formatTokens(record.promptTokens)}</td>
      <td>{formatTokens(record.completionTokens)}</td>
      <td className="muted small">{record.lastAt ? new Date(record.lastAt).toLocaleString() : '—'}</td>
    </tr>
  );
}
