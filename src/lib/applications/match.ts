import type { ApplicationRecord, JobRecord } from '@/types';

export function normalizePageUrl(url: string): string {
  return url.split('#')[0].replace(/\/+$/, '');
}

export function urlHostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function urlPathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function pathSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function pathPrefixMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = shorter === a ? b : a;
  return pathSegments(shorter).length >= 2 && longer.startsWith(shorter);
}

/**
 * Finds the application that belongs to a page URL. Job sites commonly move
 * from a posting route to an apply route, or render both as SPA tabs, so exact
 * URL matching is tried first, then path prefixes, then title/company hints.
 */
export function findApplicationForUrl(
  applications: ApplicationRecord[],
  url: string,
  title?: string,
  company?: string,
): ApplicationRecord | undefined {
  const normalized = normalizePageUrl(url);
  const exact = applications.find((application) => normalizePageUrl(application.jobUrl) === normalized);
  if (exact) return exact;

  const host = urlHostOf(url);
  const path = urlPathOf(url);
  if (host && path) {
    const prefix = applications.find((application) => urlHostOf(application.jobUrl) === host && pathPrefixMatch(path, urlPathOf(application.jobUrl)));
    if (prefix) return prefix;
  }

  const needleTitle = (title ?? '').toLowerCase().trim();
  const needleCompany = (company ?? '').toLowerCase().trim();
  if (host && (needleTitle || needleCompany)) {
    return applications.find(
      (application) =>
        urlHostOf(application.jobUrl) === host &&
        ((needleTitle.length > 3 && application.jobTitle.toLowerCase().includes(needleTitle)) ||
          (needleCompany.length > 3 && application.company.toLowerCase().includes(needleCompany))),
    );
  }
  return undefined;
}

export function findJobForUrl(jobs: JobRecord[], url: string, title?: string, company?: string): JobRecord | null {
  const normalized = normalizePageUrl(url);
  const exact = jobs.find((job) => normalizePageUrl(job.canonicalUrl) === normalized || normalizePageUrl(job.url) === normalized);
  if (exact) return exact;

  const host = urlHostOf(url);
  const path = urlPathOf(url);
  if (host && path) {
    const prefix = jobs.find((job) => urlHostOf(job.url) === host && pathPrefixMatch(path, urlPathOf(job.url) || urlPathOf(job.canonicalUrl)));
    if (prefix) return prefix;
  }

  const needleTitle = (title ?? '').toLowerCase().trim();
  const needleCompany = (company ?? '').toLowerCase().trim();
  if (host && (needleTitle || needleCompany)) {
    return (
      jobs.find(
        (job) =>
          urlHostOf(job.url) === host &&
          ((needleTitle.length > 3 && job.title.toLowerCase().includes(needleTitle)) ||
            (needleCompany.length > 3 && job.company.toLowerCase().includes(needleCompany))),
      ) ?? null
    );
  }
  return null;
}
