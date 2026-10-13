import type { Lang, Mode } from '../content/types';
import { formatDate, translate } from './i18n';
import { isoDay, type Plan } from './model';
import { daysDone, doneThisWeek } from '../results/habits';

/** One habit as the note may show it: the person's own words and the two Progress counts. */
export interface NoteHabit {
  cue: string;
  action: string;
  week: number;
  total: number;
}

/**
 * Everything the supporter note can be built from (spec, QA SM3/SM4). No Panel, rules output,
 * lever title, effort label or lever id can reach the note, because this type has no room for them.
 */
export interface NoteInput {
  habits: NoteHabit[];
  retestDate: string | null;
  link: string;
}

/** Supporter mode belongs to the person's own plan; in helper mode the plan is someone else's (QA SM2). */
export const supporterOffered = (mode: Mode, plan: Plan) => mode === 'self' && plan.habits.length > 0;

/** Copy only the person's own habit text and the day counts out of the plan. */
export function noteHabits(plan: Plan, today = isoDay()): (NoteHabit & { id: string })[] {
  return plan.habits.map((h) => ({
    id: h.id,
    cue: h.cue,
    action: h.action,
    week: doneThisWeek(plan, h.id, today),
    total: daysDone(plan, h.id),
  }));
}

/** The plain-text note. Counts sit under each habit (QA SM5); no praise, streaks or percentages. */
export function supporterNote(input: NoteInput, lang: Lang): string {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, 'self', key, vars);
  const lines: string[] = [];
  if (input.habits.length) {
    lines.push(t('supporter_note_heading'));
    for (const h of input.habits) {
      lines.push(`• ${t('habit_sentence', { cue: h.cue, action: h.action })} ${t('supporter_note_counts', { week: h.week, total: h.total })}`);
    }
  }
  if (input.retestDate) {
    if (lines.length) lines.push('');
    lines.push(t('supporter_note_retest', { date: formatDate(input.retestDate, lang) }));
  }
  if (lines.length) lines.push('');
  lines.push(t('supporter_note_closing', { app: t('app_name') }));
  lines.push(input.link);
  return lines.join('\n');
}
