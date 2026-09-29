import type { Profile } from '@/types';

export function mergeParsedIntoProfile(profile: Profile, parsed: Partial<Profile>): Profile {
  const contact = { ...profile.contact };
  for (const [key, value] of Object.entries(parsed.contact ?? {})) {
    if (value && !(contact as Record<string, unknown>)[key]) (contact as Record<string, unknown>)[key] = value;
  }
  const presence = { ...profile.presence, ...(parsed.presence ?? {}), other: [...(profile.presence.other ?? []), ...(parsed.presence?.other ?? [])] };
  return {
    ...profile,
    contact,
    presence,
    summary: parsed.summary || profile.summary,
    experience: parsed.experience && parsed.experience.length > 0 ? parsed.experience : profile.experience,
    education: parsed.education && parsed.education.length > 0 ? parsed.education : profile.education,
    skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : profile.skills,
    certifications: parsed.certifications && parsed.certifications.length > 0 ? parsed.certifications : profile.certifications,
    languages: parsed.languages && parsed.languages.length > 0 ? parsed.languages : profile.languages,
    projects: parsed.projects && parsed.projects.length > 0 ? parsed.projects : profile.projects,
    awards: parsed.awards && parsed.awards.length > 0 ? parsed.awards : profile.awards,
    updatedAt: Date.now(),
  };
}
