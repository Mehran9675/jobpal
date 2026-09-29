import type { JobAnalysis, MatchResult, Profile } from '@/types';
import { jaccard, keywordFrequency, normalizeWhitespace, tokenize } from '@/lib/utils';

export function profileSkillSet(profile: Profile): string[] {
  const fromGroups = profile.skills.flatMap((group) => group.items);
  const fromExperience = profile.experience.flatMap((item) => item.skills);
  const fromProjects = profile.projects.flatMap((item) => item.skills);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const skill of [...fromGroups, ...fromExperience, ...fromProjects]) {
    const key = skill.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(skill.trim());
  }
  return out;
}

export function experienceYears(profile: Profile): number {
  const now = Date.now();
  let months = 0;
  for (const item of profile.experience) {
    const start = parseMonth(item.start);
    const end = item.current || !item.end ? now : parseMonth(item.end);
    if (!start || !end || end <= start) continue;
    months += (end - start) / (1000 * 60 * 60 * 24 * 30.44);
  }
  return Math.round((months / 12) * 10) / 10;
}

export function parseMonth(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'present' || trimmed === 'current' || trimmed === 'now') return Date.now();
  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) return new Date(Number(yearOnly[1]), 0, 1).getTime();
  const yearMonth = trimmed.match(/(\d{4})[-/ ](\d{1,2})/);
  if (yearMonth) return new Date(Number(yearMonth[1]), Number(yearMonth[2]) - 1, 1).getTime();
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

export function profileSeniority(profile: Profile): string {
  const titles = profile.experience.map((item) => item.title.toLowerCase()).join(' ');
  const years = experienceYears(profile);
  if (/chief|cto|ceo|cpo|vp|vice president/.test(titles)) return 'executive';
  if (/principal|distinguished/.test(titles)) return 'principal';
  if (/staff/.test(titles)) return 'staff';
  if (/lead|manager|head of/.test(titles)) return 'lead';
  if (/senior|sr\.?/.test(titles) || years >= 6) return 'senior';
  if (/junior|jr\.?|intern|graduate/.test(titles) || years < 2) return 'junior';
  return 'mid';
}

export function profileToText(profile: Profile): string {
  const parts: string[] = [];
  parts.push(`${profile.contact.firstName} ${profile.contact.lastName} - ${profile.contact.headline ?? ''}`);
  if (profile.summary) parts.push(profile.summary);
  for (const group of profile.skills) parts.push(`${group.category}: ${group.items.join(', ')}`);
  for (const job of profile.experience) {
    parts.push(`${job.title} at ${job.company} (${job.start} - ${job.current ? 'present' : job.end ?? ''})`);
    if (job.description) parts.push(job.description);
    parts.push(...job.highlights);
    if (job.skills.length > 0) parts.push(job.skills.join(', '));
  }
  for (const edu of profile.education) parts.push(`${edu.degree} ${edu.field} - ${edu.school}`);
  for (const cert of profile.certifications) parts.push(`${cert.name} - ${cert.issuer}`);
  for (const project of profile.projects) parts.push(`${project.name}: ${project.description}`);
  for (const language of profile.languages) parts.push(`${language.language} (${language.level})`);
  return parts.filter(Boolean).join('\n');
}

export function jobTerms(job: { description: string; title?: string; requirements?: string[]; keywords?: string[] }): string[] {
  const explicit = [...(job.keywords ?? []), ...(job.requirements ?? [])];
  const ranked = keywordFrequency(`${job.title ?? ''} ${job.description}`, 60).map((entry) => entry.term);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of [...explicit, ...ranked]) {
    const key = term.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(term.trim());
  }
  return out;
}

function matchesTerm(skill: string, term: string): boolean {
  const a = skill.toLowerCase();
  const b = term.toLowerCase();
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  return a.includes(b) || b.includes(a);
}

export function computeMatch(profile: Profile, job: { description: string; title?: string; requirements?: string[]; keywords?: string[] }): MatchResult {
  const skills = profileSkillSet(profile);
  const terms = jobTerms(job).slice(0, 45);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const term of terms) {
    const hit = skills.some((skill) => matchesTerm(skill, term));
    if (hit) matched.push(term);
    else missing.push(term);
  }

  const description = `${job.title ?? ''} ${job.description}`;
  const descriptionTokens = tokenize(description);
  const candidateTokens = tokenize(profileToText(profile));
  const textOverlap = jaccard(descriptionTokens.slice(0, 400), candidateTokens.slice(0, 600));

  const required = job.requirements ?? [];
  const requiredCoverage =
    required.length > 0
      ? required.filter((req) => skills.some((skill) => matchesTerm(skill, req))).length / required.length
      : matched.length > 0
        ? matched.length / Math.max(1, matched.length + missing.length)
        : 0;

  const candidateSeniority = profileSeniority(profile);
  const jobSeniority = inferSeniority(description);
  const seniorityScore = seniorityAlignment(candidateSeniority, jobSeniority);
  const years = experienceYears(profile);
  const experienceScore = Math.min(1, years / 3) * 0.5 + 0.5;

  const skillScore = Math.min(1, requiredCoverage * 0.75 + (matched.length / Math.max(1, terms.length)) * 0.25);
  const score = skillScore * 60 + seniorityScore * 20 + textOverlap * 10 + experienceScore * 10;

  const reasons: string[] = [];
  if (matched.length > 0) reasons.push(`${matched.length} of the posting's key terms already appear in your experience (${matched.slice(0, 6).join(', ')}).`);
  if (missing.length > 0) reasons.push(`${missing.length} terms are not evidenced in your profile yet (${missing.slice(0, 6).join(', ')}).`);
  reasons.push(`Seniority alignment: ${seniorityScore >= 0.8 ? 'strong' : seniorityScore >= 0.5 ? 'reasonable' : 'mismatched'} (your level: ${candidateSeniority}, posting: ${jobSeniority}).`);
  reasons.push(`~${years} years of experience detected across ${profile.experience.length} roles.`);

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: finalScore,
    matchedSkills: matched.slice(0, 20),
    missingSkills: missing.slice(0, 20),
    reasons,
    recommendation: finalScore >= 82 ? 'strong_match' : finalScore >= 68 ? 'good_match' : finalScore >= 50 ? 'stretch' : 'weak_match',
  };
}

export function inferSeniority(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(chief|cto|ceo|vp|vice president)\b/.test(lower)) return 'executive';
  if (/\bprincipal\b/.test(lower)) return 'principal';
  if (/\bstaff\b/.test(lower)) return 'staff';
  if (/\b(team lead|tech lead|lead engineer|manager|head of)\b/.test(lower)) return 'lead';
  if (/\b(senior|sr\.?|5\+ years|7\+ years)\b/.test(lower)) return 'senior';
  if (/\b(junior|jr\.?|intern|internship|graduate|entry.level)\b/.test(lower)) return 'junior';
  return 'mid';
}

function seniorityRank(level: string): number {
  return { junior: 1, mid: 2, senior: 3, lead: 4, staff: 5, principal: 6, executive: 7, unspecified: 2 }[level] ?? 2;
}

export function seniorityAlignment(candidate: string, job: string): number {
  const diff = Math.abs(seniorityRank(candidate) - seniorityRank(job));
  if (diff === 0) return 1;
  if (diff === 1) return 0.75;
  if (diff === 2) return 0.4;
  return 0.15;
}

/**
 * Structural analysis extracted from the posting text. Not a generation
 * fallback: it supplies skills, keywords, seniority and red flags that the AI
 * response may omit, and is also used for the persistent match panel.
 */
export function matchFromAnalysis(analysis: JobAnalysis): MatchResult {
  const reasons = [
    analysis.summary,
    ...analysis.redFlags.map((flag) => `⚠ ${flag}`),
    `${analysis.matchedSkills.length} of your skills appear in the posting; ${analysis.missingSkills.length} requirements are not evidenced in your profile yet.`,
  ].filter((line): line is string => Boolean(line && line.trim()));
  return {
    score: analysis.matchScore,
    matchedSkills: analysis.matchedSkills,
    missingSkills: analysis.missingSkills,
    reasons,
    recommendation: analysis.recommendation,
  };
}

export function localAnalysis(profile: Profile, job: { description: string; title: string; company: string; requirements?: string[]; keywords?: string[]; employmentType?: string }): JobAnalysis {
  const match = computeMatch(profile, job);
  const description = job.description;
  const lower = description.toLowerCase();
  const responsibilities = extractBullets(description).slice(0, 8);
  const terms = jobTerms(job);
  const requiredSkills = (job.requirements && job.requirements.length > 0 ? job.requirements : terms).slice(0, 14);
  const preferredSkills = terms
    .filter((term) => !requiredSkills.includes(term))
    .filter((term) => /preferred|nice to have|bonus|plus/.test(lower) || true)
    .slice(0, 10);
  const redFlags: string[] = [];
  if (!job.description.includes('$') && !/salary|compensation|pay range/.test(lower)) redFlags.push('No compensation information listed.');
  if (/wear many hats|fast.paced|rockstar|ninja|unlimited pto/.test(lower)) redFlags.push('Contains common culture red-flag phrasing.');
  if (/unpaid|equity only/.test(lower)) redFlags.push('Mentions unpaid or equity-only work.');

  return {
    title: job.title,
    company: job.company,
    seniority: inferSeniority(description),
    employmentType: job.employmentType ?? (/contract|contractor/.test(lower) ? 'contract' : /part.time/.test(lower) ? 'part-time' : 'full-time'),
    responsibilities,
    requiredSkills,
    preferredSkills,
    keywords: terms.slice(0, 25),
    tone: 'neutral',
    cultureSignals: extractCulture(lower),
    redFlags,
    summary: `${job.title} at ${job.company}. ${responsibilities[0] ?? 'See posting for details.'}`,
    highlightBullets: requiredSkills.slice(0, 5),
    matchedSkills: match.matchedSkills,
    missingSkills: match.missingSkills,
    matchScore: match.score,
    recommendation: match.recommendation,
  };
}

function extractBullets(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line.replace(/^[-•*·]\s*/, '')))
    .filter((line) => line.length > 25 && line.length < 240);
  const unique = [...new Set(lines)];
  return unique.slice(0, 12);
}

function extractCulture(lower: string): string[] {
  const signals: string[] = [];
  if (/remote|distributed|work from home/.test(lower)) signals.push('Remote-friendly');
  if (/hybrid/.test(lower)) signals.push('Hybrid working');
  if (/equity|stock options|rsu/.test(lower)) signals.push('Equity offered');
  if (/learning budget|professional development/.test(lower)) signals.push('Learning budget');
  if (/dei|diversity/.test(lower)) signals.push('Diversity emphasis');
  if (/startup|series [a-c]/.test(lower)) signals.push('Early-stage company');
  if (/fortune 500|enterprise/.test(lower)) signals.push('Enterprise environment');
  return signals;
}
