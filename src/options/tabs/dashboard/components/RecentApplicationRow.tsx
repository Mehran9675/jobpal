import type { ApplicationRecord } from '@/types';
import { Button, ScoreRing, Show, StatusBadge } from '@/ui/components';
import { relativeTime } from '@/lib/utils';

export function RecentApplicationRow({ application, onOpen }: { application: ApplicationRecord; onOpen: (application: ApplicationRecord) => void }) {
  return (
    <tr>
      <td>
        <div className="strong">{application.jobTitle}</div>
        <div className="tiny muted">{application.site}</div>
      </td>
      <td>{application.company}</td>
      <td>
        <StatusBadge status={application.status} />
      </td>
      <td>
        <Show if={application.matchScore !== undefined}>
          <ScoreRing score={application.matchScore ?? 0} />
        </Show>
        <Show if={application.matchScore === undefined}>
          <span className="muted">—</span>
        </Show>
      </td>
      <td className="muted small nowrap">{relativeTime(application.updatedAt)}</td>
      <td className="text-right">
        <Button size="sm" variant="ghost" onClick={() => onOpen(application)}>
          Open
        </Button>
      </td>
    </tr>
  );
}
