import type { IconName } from './components/Icon';

export type GuideTarget = 'title' | 'company' | 'location' | 'salary' | 'description';

export const GUIDE_TARGETS: { target: GuideTarget; label: string; icon: IconName }[] = [
  { target: 'title', label: 'Job title', icon: 'tag' },
  { target: 'company', label: 'Company', icon: 'building' },
  { target: 'location', label: 'Location', icon: 'pin' },
  { target: 'salary', label: 'Salary', icon: 'money' },
  { target: 'description', label: 'Job description', icon: 'file' },
];

export type DocumentFunctionKind = 'resume' | 'cover_letter' | 'answers';

export const DOC_FUNCTIONS: { kind: DocumentFunctionKind; label: string }[] = [
  { kind: 'resume', label: 'Resume' },
  { kind: 'cover_letter', label: 'Cover letter' },
  { kind: 'answers', label: 'Answers' },
];
