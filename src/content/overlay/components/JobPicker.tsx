import { closeJobPicker, useRecentJob } from '../actions';
import { useOverlayState } from '../store';
import { MiniButton } from './MiniButton';
import { Icon } from './Icon';
import { Show } from '@/ui/components';

export function JobPicker() {
  const state = useOverlayState();

  const renderJob = (job: { id: string; title: string; company: string; words: number; scrapedAt: number }) => (
    <div className="jp-doc" key={job.id}>
      <div className="jp-doc-info">
        <div className="jp-doc-fn">{job.title || 'Untitled role'}</div>
        <div className="jp-doc-name">
          {[job.company, `${job.words.toLocaleString()} words`, new Date(job.scrapedAt).toLocaleDateString()].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div className="jp-doc-actions">
        <MiniButton onClick={() => void useRecentJob(job.id)}>Use</MiniButton>
      </div>
    </div>
  );

  return (
    <div className="jp-docs-page">
      <div className="jp-docs-head">
        <button type="button" className="jp-link" onClick={() => closeJobPicker()}>
          ← Back
        </button>
      </div>
      <div className="jp-guide-hint">
        Pick a job description JobPal already read. Useful when the description and the application form live on different pages or sites.
      </div>
      <Show if={state.recentJobsLoading}>
        <div className="jp-guide-value">Loading jobs…</div>
      </Show>
      <Show if={!state.recentJobsLoading && state.recentJobs.length === 0}>
        <div className="jp-guide-value">No stored jobs yet. Open a posting with the overlay and press “Check match” or “Tailor & fill” once.</div>
      </Show>
      <Show if={!state.recentJobsLoading && state.recentJobs.length > 0}>
        <div className="jp-alldocs">
          <div className="jp-docs-head">
            <span className="jp-guide-label">
              <Icon name="briefcase" size={13} />
              <span>{`Recent jobs (${state.recentJobs.length})`}</span>
            </span>
          </div>
          {state.recentJobs.map(renderJob)}
        </div>
      </Show>
    </div>
  );
}
