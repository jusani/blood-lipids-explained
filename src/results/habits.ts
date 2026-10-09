import { addDays, daysBetween, isoDay, type CheckIn, type Plan } from '../lib/model';

export const answerFor = (checkins: CheckIn[], habitId: string, date: string) =>
  checkins.find((c) => c.habitId === habitId && c.date === date)?.result ?? null;

/** Days done in total; never resets (designer S15). */
export const daysDone = (plan: Plan, habitId: string) => plan.checkins.filter((c) => c.habitId === habitId && c.result === 'done').length;

/** Monday-start week containing `today`. */
export function doneThisWeek(plan: Plan, habitId: string, today = isoDay()): number {
  const [y, m, d] = today.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
  const monday = addDays(today, -dow);
  return plan.checkins.filter((c) => c.habitId === habitId && c.result === 'done' && c.date >= monday && c.date <= today).length;
}

/** Last 28 days, oldest first. */
export function lastFourWeeks(plan: Plan, habitId: string, today = isoDay()) {
  return Array.from({ length: 28 }, (_, i) => {
    const date = addDays(today, i - 27);
    return { date, result: answerFor(plan.checkins, habitId, date) };
  });
}

/** "Welcome back" after a gap: no answer at all yesterday for a habit made before yesterday. */
export function missedYesterday(plan: Plan, today = isoDay()): boolean {
  const y = addDays(today, -1);
  const anyToday = plan.checkins.some((c) => c.date === today);
  return !anyToday && plan.habits.some((h) => h.createdAt < y && !answerFor(plan.checkins, h.id, y));
}

export const daysUntil = (date: string, today = isoDay()) => daysBetween(today, date);
