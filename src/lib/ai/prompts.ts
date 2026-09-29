import type { PromptConfig, TaskId } from '@/types';

export const TASK_LABELS: Record<TaskId, { label: string; description: string }> = {
  parseResume: { label: 'Parse resume / profile', description: 'Turn raw resume text or a LinkedIn scrape into structured profile data.' },
  analyzeJob: { label: 'Analyse job posting', description: 'Extract requirements, keywords, seniority and a match assessment.' },
  tailorResume: { label: 'Tailor resume', description: 'Rewrite the resume for one specific posting.' },
  coverLetter: { label: 'Cover letter', description: 'Write a tailored cover letter.' },
  answerQuestions: { label: 'Answer application questions', description: 'Draft answers to screening questions.' },
  matchScore: { label: 'Score job match', description: 'Produce a 0-100 fit score with reasoning.' },
};

export const SYSTEM_PROMPT_BASE = `You are JobPaal, an expert career strategist, ATS (Applicant Tracking System) optimisation specialist and professional resume writer.

Hard rules you must always follow:
1. NEVER invent or upgrade employers, job titles, seniority levels (Junior, Senior, Lead, Staff, Principal, Head, Manager, Expert or similar), dates, degrees, certifications, tools or metrics that are not present in the candidate data provided. The candidate's level is whatever their own data shows - never copy the posting's seniority onto them. You may rephrase, reorder, prioritise and re-emphasise truthfully.
2. Mirror the vocabulary of the job description whenever it is truthful for the candidate, so ATS keyword matching succeeds.
3. Write compact, high-signal content. Resume bullets start with a strong action verb and state measurable impact when the source data supports it.
4. Resumes never use first-person pronouns. Cover letters and free-text answers may use "I".
5. Never invent contact details, links or personal data.
6. If information needed for a perfect answer is missing, write the strongest truthful version rather than fabricating.
7. Return ONLY the requested output. No preamble, no explanations, no markdown code fences unless explicitly requested.`;

export const DEFAULT_TASK_TEMPLATES: Record<TaskId, string> = {
  parseResume: `Convert the raw resume / profile text below into the structured JSON schema.

Candidate name hint: {{candidateName}}

Return JSON exactly matching this shape (omit unknown fields rather than guessing):
{
  "contact": { "firstName": "", "lastName": "", "middleName": "", "headline": "", "email": "", "phone": "", "address": "", "city": "", "state": "", "postalCode": "", "country": "", "nationality": "" },
  "presence": { "linkedin": "", "github": "", "portfolio": "", "website": "", "twitter": "" },
  "summary": "",
  "skills": [{ "category": "Languages", "items": ["TypeScript"] }],
  "experience": [{ "company": "", "title": "", "location": "", "start": "2021-03", "end": "2024-01", "current": false, "description": "One sentence context", "highlights": ["Achievement bullet"], "skills": ["React"] }],
  "education": [{ "school": "", "degree": "BSc", "field": "Computer Science", "location": "", "start": "2015", "end": "2019", "gpa": "", "highlights": [] }],
  "certifications": [{ "name": "", "issuer": "", "date": "" }],
  "languages": [{ "language": "English", "level": "native" }],
  "projects": [{ "name": "", "description": "", "highlights": [], "url": "", "skills": [] }],
  "awards": [{ "title": "", "issuer": "", "date": "", "description": "" }]
}

Rules:
- Dates as YYYY-MM or YYYY when only the year is known. Use "current": true and omit "end" for present roles.
- Preserve every employer, role and date exactly as written.
- Split responsibilities into individual action-oriented bullets. Fix only obvious typos.
- Group skills into sensible categories.

RAW TEXT:
"""
{{sourceText}}
"""`,

  analyzeJob: `Analyse the job posting and the candidate profile.

Candidate skills: {{candidateSkills}}
Candidate seniority: {{candidateSeniority}}
Candidate summary: {{candidateSummary}}

Return JSON exactly in this shape:
{
  "title": "",
  "company": "",
  "seniority": "junior | mid | senior | staff | lead | principal | executive | unspecified",
  "employmentType": "full-time | part-time | contract | internship | unspecified",
  "responsibilities": ["..."],
  "requiredSkills": ["..."],
  "preferredSkills": ["..."],
  "keywords": ["ATS keywords, tools, methodologies"],
  "tone": "short description of the company voice",
  "cultureSignals": ["..."],
  "redFlags": ["anything concerning: unrealistic scope, toxic phrasing, missing salary, unpaid overtime"],
  "summary": "2-3 sentence neutral summary of the role",
  "highlightBullets": ["Top 3-5 things a candidate must prove to win this role"],
  "matchedSkills": ["candidate skills present in the posting"],
  "missingSkills": ["posting requirements absent from the candidate profile"],
  "matchScore": 0,
  "recommendation": "strong_match | good_match | stretch | weak_match"
}

matchScore is 0-100: weigh required skills (60%), seniority alignment (20%), domain/industry overlap (10%), preferred skills (10%). Be honest, not flattering.

JOB POSTING:
"""
{{jobDescription}}
"""`,

  tailorResume: `Rewrite the candidate's resume for this exact job. Keep every fact, date and employer; re-emphasise and re-word to match the posting.

Tailoring brief:
- Target title: {{jobTitle}} at {{company}}
- Seniority: {{seniority}}
- Required skills to surface: {{requiredSkills}}
- Preferred skills to surface where truthful: {{preferredSkills}}
- ATS keywords to weave in naturally: {{keywords}}
- Must-prove themes: {{highlightBullets}}

Rules:
1. Produce a headline of 4-10 words built from the candidate's real most recent role and their genuine specialisations, e.g. "Full-Stack Developer | React · Node.js · TypeScript". Align the wording with the posting only at the same level: never copy seniority words from the posting (Senior, Lead, Staff, Principal, Head, Manager, Expert) and never claim skills the candidate lacks.
2. Produce a 2-4 sentence summary aimed at this specific role.
3. For each work experience: keep company/title/dates exactly as reported; rewrite the description into one context sentence and 3-5 bullets. Put the most relevant achievements first. Use the posting's vocabulary when truthful.
4. Reorder and regroup skills so the posting's requirements appear first. Do not add skills the candidate does not have.
5. Elevate projects, certifications and education entries that support this application.
6. Keep every bullet under 30 words.

Return JSON in exactly the same shape as the candidate profile below (same keys, IDs preserved), plus a top-level "headline" string following rule 1.

CANDIDATE PROFILE:
"""
{{profileJson}}
"""

JOB POSTING:
"""
{{jobDescription}}
"""`,

  coverLetter: `Write a cover letter for this application.

- Candidate: {{candidateName}} ({{candidateHeadline}})
- Target role: {{jobTitle}} at {{company}}
- Hiring manager (use "Hiring Manager" if unknown): {{hiringManager}}
- Tone: {{tone}}
- Themes to hit: {{highlightBullets}}
- Matched strengths: {{matchedSkills}}

Structure (plain text, no markdown, no address block, no placeholders like [Company]):
1. Hook: why this company and this role specifically, referencing something concrete from the posting.
2. Proof: 2-3 short paragraphs mapping the candidate's strongest, most relevant achievements to the posting's needs. Use numbers where the profile supports them.
3. Fit: one paragraph on how the candidate works / what they'd bring.
4. Close: confident call to action.

Length: 250-350 words. Never invent facts. If a fact is missing, write around it.

CANDIDATE PROFILE:
"""
{{profileJson}}
"""

JOB POSTING:
"""
{{jobDescription}}
"""`,

  answerQuestions: `Answer the application screening questions truthfully and persuasively for this candidate.

Target role: {{jobTitle}} at {{company}}

Return JSON: { "answers": [{ "id": "<question id>", "answer": "<answer>" }] }

Rules:
- 40-120 words per answer unless the question implies shorter.
- First person, specific, no generic filler, never invent facts.
- Reference the candidate's real experience and the role's requirements.
- If a question is a salary expectation, use the candidate's stated expectation. If unknown, give a researched-sounding range with a note that it is negotiable.
- If a question is a yes/no eligibility question (authorisation, sponsorship, relocation), answer directly and truthfully from the profile.

CANDIDATE PROFILE:
"""
{{profileJson}}
"""

QUESTIONS:
"""
{{questionsJson}}
"""

JOB POSTING:
"""
{{jobDescription}}
"""`,

  matchScore: `Score how well this candidate matches the job, from 0 to 100.

Return JSON: { "score": 0, "matchedSkills": [], "missingSkills": [], "reasons": ["short reason"], "recommendation": "strong_match | good_match | stretch | weak_match" }

Weigh required skills 60%, seniority 20%, domain overlap 10%, preferred skills 10%. Be honest.

CANDIDATE PROFILE:
"""
{{profileJson}}
"""

JOB POSTING:
"""
{{jobDescription}}
"""`,
};

export const TASK_PLACEHOLDERS: Record<TaskId, string[]> = {
  parseResume: ['candidateName', 'sourceText'],
  analyzeJob: ['jobDescription', 'candidateSkills', 'candidateSeniority', 'candidateSummary'],
  tailorResume: ['jobTitle', 'company', 'seniority', 'requiredSkills', 'preferredSkills', 'keywords', 'highlightBullets', 'profileJson', 'jobDescription'],
  coverLetter: ['candidateName', 'candidateHeadline', 'jobTitle', 'company', 'hiringManager', 'tone', 'highlightBullets', 'matchedSkills', 'profileJson', 'jobDescription'],
  answerQuestions: ['jobTitle', 'company', 'profileJson', 'questionsJson', 'jobDescription'],
  matchScore: ['profileJson', 'jobDescription'],
};

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? '');
}

const TONE_LINES: Record<PromptConfig['tone'], string> = {
  professional: 'Tone: polished, professional, warm but not effusive.',
  confident: 'Tone: confident and direct. Lead with results, avoid hedging.',
  enthusiastic: 'Tone: enthusiastic and energetic while remaining credible.',
  concise: 'Tone: ruthlessly concise. Cut every unnecessary word.',
  warm: 'Tone: personable and warm, like a trusted colleague.',
};

const HARD_TRUTH_RULES =
  'HARD TRUTH RULES (never relax these): never invent, infer or upgrade employers, job titles, seniority levels (Junior, Senior, Lead, Staff, Principal, Head, Manager, Expert), dates, education, certifications, tools, skills, metrics or achievements. Only rephrase, reorder, trim and emphasise information that is already present in the candidate profile. If a job requirement is absent from the candidate data, leave it out instead of adding it.';

/**
 * Resume tailoring always uses the exact wording level: optimise presentation
 * without changing a single fact. There is no configurable level.
 */
export const EXACT_WORDING_INSTRUCTION = `${HARD_TRUTH_RULES}\nWording level: EXACT. Stay very close to the candidate's own words: keep the headline, summary and experience descriptions almost verbatim and only trim, reorder and re-emphasise. Mirror the posting's vocabulary only for skills and tools that already exist in the profile. Never rewrite job titles.`;

export function buildSystemPrompt(config: PromptConfig, task: TaskId): string {
  const parts = [SYSTEM_PROMPT_BASE, TONE_LINES[config.tone] ?? ''];
  if (task === 'tailorResume') parts.push(EXACT_WORDING_INSTRUCTION);
  if (config.writingStyle.trim()) parts.push(`Writing style: ${config.writingStyle.trim()}`);
  if (config.avoidWords.length > 0) parts.push(`Never use these words or phrases: ${config.avoidWords.join(', ')}.`);
  if (config.emphasize.length > 0) parts.push(`Emphasise these themes where truthful: ${config.emphasize.join(', ')}.`);
  if (task === 'tailorResume' || task === 'coverLetter') {
    parts.push('The output must be immediately usable: no placeholders, no notes to the user, no square-bracket blanks.');
  }
  if (task === 'parseResume' || task === 'analyzeJob' || task === 'answerQuestions' || task === 'matchScore') {
    parts.push('Respond with valid, parseable JSON only.');
  }
  if (config.globalInstructions.trim()) {
    parts.push(`Additional standing instructions from the user (highest priority after the hard rules):\n${config.globalInstructions.trim()}`);
  }
  return parts.filter(Boolean).join('\n\n');
}

export function taskTemplate(config: PromptConfig, task: TaskId): string {
  return config.templates[task]?.trim() || DEFAULT_TASK_TEMPLATES[task];
}
