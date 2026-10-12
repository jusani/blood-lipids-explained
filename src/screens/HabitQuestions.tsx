import { useState } from 'preact/hooks';
import { useApp } from '../app';
import { habitQuestions, type HabitAnswers } from '../lib/questionnaire';

// "Good to know" facts after questions 3 and 6. Everyone sees both, whatever they answered or
// skipped: general facts only, never about the answer just given (evidence 2026.4, QA note).
const GOOD_TO_KNOW: Record<number, string> = { 2: 'str_gtk_1', 5: 'str_gtk_2' };

// S10 habit questionnaire: one question per screen, progress shown, every question skippable.
// Answers only suggest if-then cues on the plan screen (QA M2).
export function HabitQuestions() {
  const { t, plan, setPlan, back } = useApp();
  const [answers, setAnswers] = useState<HabitAnswers>({ ...(plan.answers ?? {}) });
  const [i, setI] = useState(0);
  const [fact, setFact] = useState<{ key: string; next: HabitAnswers } | null>(null);
  const total = habitQuestions.length;

  const finish = async (a: HabitAnswers) => {
    const clean = Object.fromEntries(Object.entries(a).filter(([, v]) => v));
    await setPlan({ ...plan, answers: clean });
    back();
  };
  const answer = (v: string | null) => {
    const q = habitQuestions[i];
    const next = { ...answers, [q.id]: v ?? undefined };
    setAnswers(next);
    if (GOOD_TO_KNOW[i]) setFact({ key: GOOD_TO_KNOW[i], next });
    else advance(next);
  };
  const advance = (a: HabitAnswers) => {
    setFact(null);
    if (i + 1 < total) setI(i + 1);
    else void finish(a);
  };

  if (fact) {
    return (
      <>
        <h1 tabIndex={-1} key={fact.key}>{t('hq_gtk_title')}</h1>
        <p>{t(fact.key)}</p>
        <button class="btn" onClick={() => advance(fact.next)}>{t('continue')}</button>
      </>
    );
  }

  const q = habitQuestions[i];
  return (
    <>
      <p class="small" aria-live="polite">{t('hq_progress', { n: i + 1, total })}</p>
      <h1 tabIndex={-1} key={q.id}>{t(q.text)}</h1>
      <div class="stack" role="group" aria-label={t(q.text)}>
        {q.options.map((o) => (
          <button key={o} class="choice" aria-pressed={answers[q.id] === o} onClick={() => answer(o)}>
            <b>{t(`hq_${o}`)}</b>
          </button>
        ))}
      </div>
      <button class="btn ghost" onClick={() => answer(null)}>{t('hq_skip')}</button>
      {i > 0 && <button class="linkbtn" onClick={() => setI(i - 1)}>{t('hq_previous')}</button>}
    </>
  );
}
