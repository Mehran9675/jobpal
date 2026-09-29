import type { ApplicationRecord } from '@/types';
import { EmptyState, Show } from '@/ui/components';
import { IconBriefcase } from '@/ui/components/Icons';
import { ApplicationRow } from './ApplicationRow';

const MAX_VISIBLE_APPLICATIONS = 3;

export function RecentApplicationsCard({
  applications,
  onOpenApplication,
  onViewAll,
}: {
  applications: ApplicationRecord[];
  onOpenApplication: (application: ApplicationRecord) => void;
  onViewAll: () => void;
}) {
  const visible = applications.slice(0, MAX_VISIBLE_APPLICATIONS);
  const hasApplications = applications.length > 0;

  const renderApplication = (application: ApplicationRecord) => (
    <ApplicationRow key={application.id} application={application} onOpen={onOpenApplication} />
  );

  return (
    <div className="card card--flat">
      <div className="card__header">
        <div className="card__title">
          <IconBriefcase size={14} /> Recent applications
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onViewAll}>
          View all
        </button>
      </div>
      <Show if={!hasApplications}>
        <EmptyState
          title="No applications yet"
          text="Open a job posting and press “Tailor & fill” — JobPal will build your documents and archive them here."
        />
      </Show>
      <Show if={hasApplications}>
        <div className="list">{visible.map(renderApplication)}</div>
      </Show>
    </div>
  );
}
