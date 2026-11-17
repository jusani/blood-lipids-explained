import { pack } from '../content';
import type { HabitExample, Lang } from '../content/types';

// Daily habit examples (2026.7): fixed when/then pairs inside their option, the same for everyone,
// never ranked by the habit answers (qa.md §18).
export const habitsFor = (leverId: string): HabitExample[] => (pack.habit_examples ?? []).filter((h) => h.lever === leverId);

/**
 * The two fields a tap fills. The form already says "When…" / "then I will…" (LT "Kai…" / "tada aš…"),
 * so a leading "When" / "I will" / "Kai" is left out of the fields; anything else stays as written.
 */
export function fieldsFor(h: HabitExample, lang: Lang): { cue: string; action: string } {
  const { when, then } = h.text[lang];
  const cue = lang === 'lt' ? when.replace(/^Kai\s+/, '') : when.replace(/^When\s+/i, '');
  const action = lang === 'lt' ? then : then.replace(/^I will\s+/i, '');
  return { cue, action };
}
