import type { ApplicationRecord } from '@/types';
import { StatusBadge } from '@/ui/components';
import { relativeTime } from '@/lib/utils';

export function ApplicationRow({ application, onOpen }: { application: ApplicationRecord; onOpen: (application: ApplicationRecord) => void }) {
  return (
    <div className="list-item" style={{ cursor: 'pointer' }} onClick={() => onOpen(application)}>
      <div className="list-item__main">
        <div className="list-item__title">{application.jobTitle}</div>
        <div className="list-item__meta">
          {application.company} · {relativeTime(application.updatedAt)}
        </div>
      </div>
      <StatusBadge status={application.status} />
    </div>
  );
}
