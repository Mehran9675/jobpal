import type { AgentQueueItem } from '@/types';
import { Badge, Button, Show } from '@/ui/components';
import { IconRefresh, IconTrash } from '@/ui/components/Icons';
import { relativeTime } from '@/lib/utils';

export function QueueItemRow({
  item,
  onRetry,
  onRemove,
}: {
  item: AgentQueueItem;
  onRetry: (item: AgentQueueItem) => void;
  onRemove: (item: AgentQueueItem) => void;
}) {
  return (
    <div className="list-item">
      <div className="list-item__main">
        <div className="list-item__title">{item.title || item.url}</div>
        <div className="list-item__meta">
          {item.company || item.site} · added {relativeTime(item.addedAt)}
          {item.reason ? ` · ${item.reason}` : ''}
        </div>
      </div>
      <div className="row">
        <Show if={item.status === 'failed' || item.status === 'skipped' || item.status === 'needs-attention'}>
          <Button size="sm" variant="outline" icon={<IconRefresh size={13} />} onClick={() => onRetry(item)}>
            Retry
          </Button>
        </Show>
        <Badge
          tone={
            item.status === 'done' ? 'success' : item.status === 'failed' ? 'danger' : item.status === 'needs-attention' ? 'warning' : item.status === 'processing' ? 'primary' : 'neutral'
          }
        >
          {item.status}
        </Badge>
        <Button size="sm" variant="ghost" icon={<IconTrash size={13} />} title="Remove from queue" onClick={() => onRemove(item)} />
      </div>
    </div>
  );
}
