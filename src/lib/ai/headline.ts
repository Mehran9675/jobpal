import type { JobAnalysis, Profile } from '@/types';

/** Cleans an AI-provided headline. Returns null when it is unusable. */
export function sanitizeHeadline(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, ' ').replace(/\s*\|\s*/g, ' | ').trim();
  if (cleaned.length < 3 || cleaned.length > 140) return null;
  return cleaned;
}

/**
 * Builds a truthful fallback headline from the candidate's own data: their real
 * most recent title plus the specialisations they genuinely have. The posting's
 * title is never copied, so a stale or inflated level cannot leak through.
 */
export function buildLocalHeadline(profile: Profile, analysis: JobAnalysis): string {
  const ownTitle =
    profile.experience.find((item) => item.current)?.title?.trim() ||
    profile.experience[0]?.title?.trim() ||
    '';
  const title = ownTitle || profile.contact.headline?.trim() || '';
  const matched = analysis.matchedSkills.filter((skill) => skill.trim().length > 1).slice(0, 4);
  const parts = [title, ...matched].filter(Boolean);
  const headline = parts.join(' | ').trim();
  return headline.length > 3 ? headline.slice(0, 140) : profile.contact.headline ?? '';
}
