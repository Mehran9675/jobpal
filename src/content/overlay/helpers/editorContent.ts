import type { Profile } from '@/types';
import type { EditableContentKind } from '@/lib/doc/content';

/** The parsed, editable form of a document's stored content. */
export type EditorDraft =
  | { kind: 'resume'; profile: Profile }
  | { kind: 'cover_letter'; text: string }
  | { kind: 'answers'; answers: { question: string; answer: string }[] };

export function parseEditorContent(kind: EditableContentKind, content: string): EditorDraft | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (kind === 'resume') {
      const profile = parsed as Profile;
      if (!profile || typeof profile !== 'object' || !profile.contact) return null;
      const list = <T,>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);
      return {
        kind,
        profile: {
          ...profile,
          summary: profile.summary ?? '',
          skills: list(profile.skills),
          experience: list(profile.experience),
          education: list(profile.education),
          certifications: list(profile.certifications),
          languages: list(profile.languages),
          projects: list(profile.projects),
          awards: list(profile.awards),
        },
      };
    }
    if (kind === 'cover_letter') {
      const text = (parsed as { text?: unknown }).text;
      return typeof text === 'string' ? { kind, text } : null;
    }
    const answers = (parsed as { answers?: unknown }).answers;
    if (!Array.isArray(answers)) return null;
    return {
      kind,
      answers: answers.map((entry) => ({
        question: String((entry as { question?: unknown }).question ?? ''),
        answer: String((entry as { answer?: unknown }).answer ?? ''),
      })),
    };
  } catch {
    return null;
  }
}

export function serializeEditorDraft(draft: EditorDraft): string {
  if (draft.kind === 'resume') {
    const clean = (lines: string[]) => lines.filter((line) => line.trim().length > 0);
    const profile: Profile = {
      ...draft.profile,
      experience: draft.profile.experience.map((entry) => ({ ...entry, highlights: clean(entry.highlights) })),
      education: draft.profile.education.map((entry) => ({ ...entry, highlights: clean(entry.highlights) })),
      projects: draft.profile.projects.map((entry) => ({ ...entry, highlights: clean(entry.highlights) })),
    };
    return JSON.stringify(profile);
  }
  if (draft.kind === 'cover_letter') return JSON.stringify({ text: draft.text });
  return JSON.stringify({ answers: draft.answers });
}

/** Returns a copy of the list with one entry patched (used by the resume form). */
export function withListEntry<T>(list: T[], index: number, patch: Partial<T>): T[] {
  return list.map((entry, position) => (position === index ? { ...entry, ...patch } : entry));
}
