import type { ApplicationRecord, AutomationSettings, ExtractedJob, JobAnalysis, Profile } from '@/types';
import { profileSeniority, inferSeniority, seniorityAlignment } from '@/lib/job/match';

export interface RuleEvaluation {
  allowed: boolean;
  blockers: string[];
  notes: string[];
}

interface EvaluateInput {
  job: ExtractedJob;
  analysis?: JobAnalysis;
  settings: AutomationSettings;
  profile: Profile;
  applications: ApplicationRecord[];
}

function ruleEnabled(settings: AutomationSettings, id: string): boolean {
  return settings.rules[id]?.enabled ?? false;
}

function ruleValue(settings: AutomationSettings, id: string): number {
  const value = settings.rules[id]?.value;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSalary(text: string | undefined): { min: number; max: number } | null {
  if (!text) return null;
  const cleaned = text.replace(/,/g, '');
  const matches = [...cleaned.matchAll(/(\d{2,3})(?:\.\d+)?\s*(k)?/gi)].map((match) => {
    const base = Number(match[1]);
    return /k/i.test(match[2] ?? '') ? base * 1000 : base >= 1000 ? base : base * 1000;
  });
  const values = matches.filter((value) => value >= 10000);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

const AGENCY_PATTERNS = /(staffing|recruit(ment|ing)?|talent (agency|marketplace|solutions)|head ?hunt|placement agency|manpower|adecco|randstad|hays |robert half|michael page|kforce|insight global)/i;

export function evaluateRules({ job, analysis, settings, profile, applications }: EvaluateInput): RuleEvaluation {
  const blockers: string[] = [];
  const notes: string[] = [];
  const description = `${job.title} ${job.description}`.toLowerCase();

  if (ruleEnabled(settings, 'match-experience-only')) {
    const threshold = ruleValue(settings, 'match-experience-only') || settings.matchThreshold;
    const score = analysis?.matchScore ?? 0;
    if (score < threshold) blockers.push(`Match score ${score} is below your threshold of ${threshold}.`);
    else notes.push(`Match score ${score} ≥ ${threshold}.`);
  }

  if (!ruleEnabled(settings, 'allow-missing-skills') && analysis && analysis.missingSkills.length > 0) {
    blockers.push(`Posting requires ${analysis.missingSkills.length} skill(s) missing from your profile: ${analysis.missingSkills.slice(0, 4).join(', ')}.`);
  }

  if (ruleEnabled(settings, 'remote-only') && !job.remote) {
    blockers.push('Role does not appear to be remote.');
  }

  if (ruleEnabled(settings, 'require-salary') && !job.salary) {
    blockers.push('No salary information listed.');
  }

  if (ruleEnabled(settings, 'salary-floor')) {
    const floor = ruleValue(settings, 'salary-floor');
    const parsed = parseSalary(job.salary ?? job.description.slice(0, 4000));
    if (parsed && floor > 0 && parsed.max < floor) blockers.push(`Listed salary (max ${parsed.max.toLocaleString()}) is below your floor of ${floor.toLocaleString()}.`);
  }

  if (ruleEnabled(settings, 'max-posting-age') && job.postedAt) {
    const maxDays = ruleValue(settings, 'max-posting-age');
    const posted = Date.parse(job.postedAt);
    if (!Number.isNaN(posted) && maxDays > 0) {
      const ageDays = (Date.now() - posted) / (1000 * 60 * 60 * 24);
      if (ageDays > maxDays) blockers.push(`Posting is ${Math.round(ageDays)} days old (limit ${maxDays}).`);
    }
  }

  if (ruleEnabled(settings, 'skip-staffing-agencies') && (AGENCY_PATTERNS.test(job.company) || AGENCY_PATTERNS.test(description.slice(0, 1200)))) {
    blockers.push('Looks like a staffing agency or recruitment marketplace.');
  }

  if (ruleEnabled(settings, 'seniority-match')) {
    const candidate = profileSeniority(profile);
    const role = analysis?.seniority ?? inferSeniority(`${job.title} ${job.description}`);
    if (seniorityAlignment(candidate, role) < 0.4) blockers.push(`Seniority mismatch: you are ${candidate}, posting is ${role}.`);
    else notes.push(`Seniority alignment (${candidate} vs ${role}) is acceptable.`);
  }

  if (ruleEnabled(settings, 'dedupe-applications')) {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const duplicate = applications.find(
      (application) => application.company.toLowerCase() === job.company.toLowerCase() && application.createdAt > ninetyDaysAgo && application.status !== 'withdrawn',
    );
    if (duplicate) blockers.push(`You already applied to ${job.company} on ${new Date(duplicate.createdAt).toLocaleDateString()} (rule: never apply twice).`);
  }

  if (settings.allowlistEnabled && settings.allowlist.length > 0) {
    const host = safeHost(job.url);
    if (!settings.allowlist.some((allowed) => host.includes(allowed.trim().toLowerCase()) || allowed.trim().toLowerCase().includes(host))) {
      blockers.push(`Domain ${host} is not in your allowlist.`);
    }
  }

  const host = safeHost(job.url);
  if (settings.neverSubmitDomains.some((blocked) => blocklistMatch(host, blocked))) {
    blockers.push(`Domain ${host} is on your never-submit list.`);
  }

  return { allowed: blockers.length === 0, blockers, notes };
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function blocklistMatch(host: string, pattern: string): boolean {
  const clean = pattern.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!clean) return false;
  return host === clean || host.endsWith(`.${clean}`) || host.includes(clean);
}

export function withinWorkingHours(settings: AutomationSettings, now = new Date()): boolean {
  if (!settings.workingHours.enabled) return true;
  const day = now.getDay();
  if (!settings.workingHours.days.includes(day)) return false;
  const hour = now.getHours();
  const { start, end } = settings.workingHours;
  if (start <= end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function shouldAutoSubmit(
  settings: AutomationSettings,
  options: { confidence: number; blockers: string[]; host: string },
): { submit: boolean; reason: string } {
  if (!settings.autoSubmit) return { submit: false, reason: 'Auto-submit is disabled — review the form and press submit yourself.' };
  if (settings.mode !== 'auto') return { submit: false, reason: 'The agent is in assist mode.' };
  if (ruleEnabled(settings, 'review-before-submit')) return { submit: false, reason: 'Your rule "Always ask me before submitting" is enabled.' };
  if (options.blockers.length > 0) return { submit: false, reason: options.blockers[0] };
  if (options.confidence < settings.minConfidenceToSubmit) {
    return { submit: false, reason: `Form fill confidence ${(options.confidence * 100).toFixed(0)}% is below your threshold of ${(settings.minConfidenceToSubmit * 100).toFixed(0)}%.` };
  }
  const host = options.host;
  if (settings.neverSubmitDomains.length > 0 && settings.neverSubmitDomains.some((blocked) => blocklistMatch(host, blocked))) {
    return { submit: false, reason: `${host} is on your never-submit list.` };
  }
  if (settings.allowlistEnabled && !settings.allowlist.some((allowed) => blocklistMatch(host, allowed))) {
    return { submit: false, reason: `${host} is not in your allowlist.` };
  }
  return { submit: true, reason: 'All rules satisfied.' };
}
