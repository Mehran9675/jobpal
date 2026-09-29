import type { ExtractedJob, PageContext } from '@/types';
import type { PastedJobInput } from '@/ui/components/PasteJobModal';

export function pageHost(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Builds the job record for a manually pasted description. */
export function buildPastedJob(input: PastedJobInput, context: PageContext | null): ExtractedJob {
  const site = context?.site && context.site !== 'other' && context.site !== 'linkedin-profile' ? context.site : 'generic';
  return {
    url: context?.url ?? '',
    canonicalUrl: context?.url ?? '',
    site,
    title: input.title || context?.jobTitle || context?.title || 'Target role',
    company: input.company || context?.company || pageHost(context?.url),
    description: input.text,
    requirements: [],
    keywords: [],
  };
}
