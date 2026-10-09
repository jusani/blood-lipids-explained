import { useApp } from '../app';
import { formatDate } from '../lib/i18n';
import { isoDay, type CheckIn } from '../lib/model';
import { answerFor, daysUntil, missedYesterday } from '../results/habits';

// S14 Today: one row per habit, Done / Not today, one tap. No streaks, no red.
export function Today() {
  const { t, lang, plan, setPlan, go } = useApp();
  const today = isoDay();
  const mark = (habitId: string, result: CheckIn['result'] | null) => {
    const rest = plan.checkins.filter((c) => !(c.habitId === habitId && c.date === today));
    void setPlan({ ...plan, checkins: result ? [...rest, { habitId, date: today, result }] : rest });
  };
  const left = plan.retestDate ? daysUntil(plan.retestDate, today) : null;

  return (
    <>
      <h1 tabIndex={-1}>{t('today_title')}</h1>
      <p class="small">{formatDate(today, lang)}</p>
      {missedYesterday(plan, today) && <p class="notice">{t('today_welcome_back')}</p>}
      {plan.habits.length === 0 && <p>{t('today_empty')}</p>}
      {plan.habits.map((h) => {
        const a = answerFor(plan.checkins, h.id, today);
        return (
          <section class="card" key={h.id} aria-label={t('habit_sentence', { cue: h.cue, action: h.action })}>
            <p>{t('habit_sentence', { cue: h.cue, action: h.action })}</p>
            {a ? (
              <p class="small" role="status">
                {t(a === 'done' ? 'today_marked_done' : 'today_marked_not')}{' '}
                <button class="linkbtn inline" onClick={() => mark(h.id, null)}>{t('today_undo')}</button>
              </p>
            ) : (
              <div class="pair">
                <button class="btn" onClick={() => mark(h.id, 'done')}>{t('today_done')}</button>
                <button class="btn ghost" onClick={() => mark(h.id, 'not_today')}>{t('today_not')}</button>
              </div>
            )}
          </section>
        );
      })}
      {plan.retestDate && left !== null && (
        <p class="small">
          {t('retest_line', { date: formatDate(plan.retestDate, lang) })}
          {' · '}
          {left > 0 ? t('retest_days_left', { n: left }) : left === 0 ? t('retest_today') : t('retest_passed')}
        </p>
      )}
      <div class="stack">
        {plan.habits.length > 0 && <button class="btn ghost" onClick={() => go('progress')}>{t('progress_btn')}</button>}
        <button class="btn ghost" onClick={() => go('plan')}>{t('plan_edit')}</button>
        <button class="btn ghost" onClick={() => go('retest')}>{t('retest_btn')}</button>
      </div>
    </>
  );
}
