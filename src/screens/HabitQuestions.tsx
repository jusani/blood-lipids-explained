import { useState } from 'preact/hooks';
import { useApp } from '../app';
import { habitQuestions, type HabitAnswers } from '../lib/questionnaire';

// S10 habit questionnaire: one question per screen, progress shown, every question skippable.
// Answers only suggest if-then cues on the plan screen (QA M2).
export function HabitQuestions() {
  const { t, plan, setPlan, back } = useApp();
  const [answers, setAnswers] = useState<HabitAnswers>({ ...(plan.answers ?? {}) });
  const [i, setI] = useState(0);
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
    if (i + 1 < total) setI(i + 1);
    else void finish(next);
  };

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
