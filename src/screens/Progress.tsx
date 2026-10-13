import { useApp } from '../app';
import { supporterOffered } from '../lib/supporterNote';
import { daysDone, doneThisWeek, lastFourWeeks } from '../results/habits';

// S15 Progress: days done (never resets) and a 4-week dot strip. No percentages, streaks or red.
// The habit-strength curve waits for a sourced claim about how long habits take to form.
export function Progress() {
  const { t, mode, plan, go } = useApp();
  return (
    <>
      <h1 tabIndex={-1}>{t('progress_title')}</h1>
      {plan.habits.map((h) => {
        const dots = lastFourWeeks(plan, h.id);
        return (
          <section class="card" key={h.id}>
            <h2 class="h3">{t('habit_sentence', { cue: h.cue, action: h.action })}</h2>
            <p>{t('progress_week', { n: doneThisWeek(plan, h.id) })}</p>
            <p><b>{t('progress_days', { n: daysDone(plan, h.id) })}</b></p>
            <div class="dots" role="img" aria-label={t('progress_dots_label', { done: dots.filter((d) => d.result === 'done').length })}>
              {dots.map((d) => <span key={d.date} class={`dot ${d.result ?? 'none'}`} />)}
            </div>
          </section>
        );
      })}
      <p class="small">{t('progress_legend')}</p>
      {supporterOffered(mode, plan) && <button class="btn ghost" onClick={() => go('supporter')}>{t('supporter_btn')}</button>}
    </>
  );
}
