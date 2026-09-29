import { useOverlayState } from '../store';
import { jobBadgeFor } from '../helpers/jobBadge';

export function JobCard() {
  const state = useOverlayState();
  const job = state.job;
  const meta = [job?.company || state.context.company, job?.location].filter(Boolean).join(' · ');

  return (
    <div className="jp-job">
      <p className="jp-job-title">{job?.title || state.context.jobTitle || state.context.title || 'No job detected'}</p>
      <p className="jp-job-meta">{meta || location.hostname}</p>
      <span className="jp-badge">{jobBadgeFor(state.context, job)}</span>
    </div>
  );
}
