import type { ApplicationQuestion, DocKind, Profile } from '@/types';

/** Kinds whose source content can be shown and edited in the overlay. */
export type EditableContentKind = 'resume' | 'cover_letter' | 'answers';

export interface CoverLetterContent {
  text: string;
}

export interface AnswersContent {
  answers: { question: string; answer: string }[];
}

export function isEditableKind(kind: DocKind): kind is EditableContentKind {
  return kind === 'resume' || kind === 'cover_letter' || kind === 'answers';
}

export function serializeResumeContent(profile: Profile): string {
  return JSON.stringify(profile);
}

export function serializeCoverLetterContent(text: string): string {
  return JSON.stringify({ text } satisfies CoverLetterContent);
}

export function serializeAnswersContent(answers: ApplicationQuestion[]): string {
  return JSON.stringify({ answers: answers.map((answer) => ({ question: answer.label, answer: answer.answer ?? '' })) } satisfies AnswersContent);
}
