import { Badge } from './Badge';

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'offer' || status === 'interview' || status === 'technical'
      ? 'success'
      : status === 'rejected'
        ? 'danger'
        : status === 'applied' || status === 'screening'
          ? 'primary'
          : status === 'queued' || status === 'ready'
            ? 'info'
            : 'neutral';
  return <Badge tone={tone}>{status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</Badge>;
}
