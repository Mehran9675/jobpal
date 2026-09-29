import type { AppSettings } from '@/types';

/** Bump this when the terms change so every user must accept them again. */
export const TERMS_VERSION = 1;

export interface LegalSection {
  title: string;
  body: string;
}

export interface LegalCheck {
  id: string;
  statement: string;
}

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: '1. What JobPaal does',
    body: 'JobPaal is a browser extension that keeps a private record of your job applications and produces ATS-optimised documents (resume, cover letter and screening answers) for each job you choose, using the AI provider you connect. It is provided under the MIT licence, as is and without warranty of any kind.',
  },
  {
    title: '2. Your data stays with you',
    body: 'Every piece of data you enter - profile, resumes, applications, generated documents and answers - is stored locally in your own browser. JobPaal does not and is not able to transmit your data to the developer, and the developer does not and cannot collect, receive, retain, harvest, sell or share it. The extension contains no analytics, telemetry, tracking or advertising, and operates no server of its own.',
  },
  {
    title: '3. The AI provider you choose',
    body: 'When you generate content, only the data required for that request is sent directly from your browser to the AI service you configured. That service processes your data under its own terms and privacy policy, which JobPaal cannot access, control or change. You are responsible for choosing providers whose data-handling practices you accept, and for reviewing their policies before connecting them.',
  },
  {
    title: '4. Truthful documents only',
    body: 'JobPaal optimises the presentation of the facts you provide; it is not designed to create facts. It must not be used to fabricate, inflate or misrepresent experience, job titles, seniority, dates, education, skills or any other qualification. The developer does not condone, promote or recommend resume fraud, misrepresentation or any other deceptive employment practice. You are solely responsible for the accuracy, completeness and legality of everything you submit.',
  },
  {
    title: '5. Your responsibilities',
    body: 'You are responsible for: complying with all laws and regulations applicable to your job applications, including data protection and employment rules; complying with the terms of service of any website you use together with JobPaal; answering eligibility, work-authorisation, sponsorship and demographic questions yourself; reviewing every generated document, answer and filled field before submitting it; and keeping your own API keys and accounts secure.',
  },
  {
    title: '6. No warranty and limitation of liability',
    body: 'The extension is provided as is and as available, without warranties of any kind, express or implied. To the maximum extent permitted by law, the developer is not liable for any loss or damage arising from its use, including rejected applications, account restrictions imposed by third-party sites, or reliance on generated content.',
  },
];

export const TERMS_CHECKS: LegalCheck[] = [
  { id: 'read', statement: 'I have read and agree to the Terms of Use and Privacy Policy.' },
  { id: 'local', statement: 'I understand that JobPaal does not, and is not able to, retain or harvest my data.' },
  {
    id: 'provider',
    statement: 'I understand that JobPaal cannot control or change the data-handling policies of the AI solution I choose to use.',
  },
  {
    id: 'law',
    statement: 'I will ensure compliance with the local laws and regulations applicable to job applications.',
  },
  {
    id: 'truth',
    statement:
      'I understand that I am solely responsible for the accuracy of the content I submit, and that JobPaal does not condone, promote or recommend resume fraud.',
  },
];

export function termsAccepted(settings: AppSettings): boolean {
  return settings.terms?.version === TERMS_VERSION && Boolean(settings.terms?.acceptedAt);
}
