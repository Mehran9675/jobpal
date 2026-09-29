import type { ExtractedJob, PageContext } from '@/types';

/** The badge shown on the job card, based on what was detected on the page. */
export function jobBadgeFor(context: PageContext, job: ExtractedJob | null): string {
  if (context.hasApplicationForm) return 'Application form detected';
  if (context.hasJob) return 'Job posting detected';
  if (job) return 'Using your manual selection';
  return 'Not detected - guide JobPal';
}
