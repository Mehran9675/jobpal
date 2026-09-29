import type { ApplicationRecord } from '@/types';
import { Button, Show, StatusBadge } from '@/ui/components';
import { relativeTime } from '@/lib/utils';

export function ApplicationRow({ application, onOpen }: { application: ApplicationRecord; onOpen: (application: ApplicationRecord) => void }) {
  return (
    <tr style={{ cursor: 'pointer' }} onClick={() => onOpen(application)}>
      <td>
        <div className="strong">{application.jobTitle}</div>
        <div className="tiny muted">
          {application.site} · {application.source === 'agent' ? 'agent' : 'manual'}
          <Show if={application.autoSubmitted}> · auto-submitted</Show>
        </div>
      </td>
      <td>{application.company}</td>
      <td>
        <StatusBadge status={application.status} />
      </td>
      <td>
        <Show if={application.matchScore !== undefined}>{`${Math.round(application.matchScore ?? 0)}%`}</Show>
        <Show if={application.matchScore === undefined}>
          <span className="muted">-</span>
        </Show>
      </td>
      <td className="muted small">{application.documents.length}</td>
      <td className="muted small nowrap">{relativeTime(application.updatedAt)}</td>
      <td className="text-right">
        <Button size="sm" variant="ghost">
          Open
        </Button>
      </td>
    </tr>
  );
}
