import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../app';
import { pack } from '../content';
import { isoDay, MAX_HABITS, newId } from '../lib/model';
import { rankLevers, runRules } from '../lib/rules';
import { cuesFor, type HabitAnswers } from '../lib/questionnaire';
import { SourceQuotes } from '../components/SourceQuotes';
import { CARD_HEAD } from '../results/present';

// S11 options + S12 if-then builder. Habit options are lifestyle claims, so they come only
// from an approved content pack with sourced options ("levers"); 2026.1 has none, so the
// person writes their own habit. Options, when they arrive, are ordered only by which
// values are outside the guideline ranges (QA M2).
export function Plan() {
  const { t, settings, current, plan, setPlan, keepPanel, go, isSaved } = useApp();
  const r = useMemo(() => (current ? runRules(current) : null), [current]);
  const [cue, setCue] = useState('');
  const [action, setAction] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const full = plan.habits.length >= MAX_HABITS;
  const keeping = settings.storageConsent === 'keep';
  // Moments suggested by the habit answers come first; they never touch the options (QA M2).
  const cues = [...new Set([...cuesFor(plan.answers as HabitAnswers).map((k) => t(k)), ...t('ifthen_cues').split('|')])];
  const answered = Object.keys(plan.answers ?? {}).length > 0;
  const hasLevers = (pack.rules.levers ?? []).length > 0;
  const options = r && hasLevers ? rankLevers(r.outOfRange) : [];
  const cfg = pack.rules.levers_config;
  const [leverId, setLeverId] = useState<string | null>(null);
  const [openSrc, setOpenSrc] = useState<string | null>(null);
  const [showSupp, setShowSupp] = useState(false);
  const choose = (id: string, title: string) => {
    setLeverId(id);
    setAction(title);
    setMsg(t('lever_chosen'));
    document.getElementById('cue')?.focus();
  };

  const save = async () => {
    if (!cue.trim() || !action.trim()) { setMsg(t('ifthen_missing')); return; }
    // Saving a habit is the person choosing to keep data on this phone (the note above says so).
    if (current && (!keeping || !isSaved(current.id))) await keepPanel(current);
    await setPlan({
      ...plan,
      habits: [...plan.habits, { id: newId(), cue: cue.trim().slice(0, 120), action: action.trim().slice(0, 160), createdAt: isoDay(), leverId }],
    });
    setCue(''); setAction(''); setLeverId(null); setMsg(null);
  };
  const remove = async (id: string) => {
    await setPlan({ ...plan, habits: plan.habits.filter((h) => h.id !== id), checkins: plan.checkins.filter((c) => c.habitId !== id) });
    setMsg(t('habit_removed'));
  };

  return (
    <>
      <h1 tabIndex={-1}>{t('plan_title')}</h1>
      {r && r.doctorCards.length > 0 && (
        <div class="dcard">
          <p class="dcard-label">{t('flag_label')}</p>
          {r.doctorCards.map((f) => <p key={f.id}><b>{t(CARD_HEAD[f.id] ?? 'results_headline_doctor')}</b></p>)}
          <p>{t(cfg?.note_with_doctor_flag ?? 'plan_alongside_treatment')}</p>
        </div>
      )}
      {current?.safety.cholMedicine === 'yes' && <p class="info">{t(cfg?.note_on_medicine ?? 'plan_alongside_medicine')}</p>}
      {!hasLevers && <p class="small">{t('options_pending')}</p>}

      {options.length > 0 && !full && (
        <section class="stack" aria-labelledby="opt-h">
          <h2 id="opt-h">{t(cfg?.heading ?? 'plan_offer_title')}</h2>
          {options.map((l) => (
            <article class="card" key={l.id}>
              <h3 class="h3">{t(l.title)}</h3>
              <p>{t(l.text)}</p>
              <p class="small">{t(`lever_effort_${l.effort}`)}</p>
              <button class="linkbtn" aria-expanded={openSrc === l.id} onClick={() => setOpenSrc(openSrc === l.id ? null : l.id)}>{t('lever_sources')}</button>
              {openSrc === l.id && <SourceQuotes claimIds={[l.claim].flat()} />}
              <button class={leverId === l.id ? 'btn' : 'btn ghost'} aria-pressed={leverId === l.id} onClick={() => choose(l.id, t(l.title))}>{t('lever_choose')}</button>
            </article>
          ))}
          <button class="linkbtn" aria-expanded={showSupp} onClick={() => setShowSupp(!showSupp)}>{t('plan_supplements_q')}</button>
          {showSupp && pack.strings.str_supplements_answer && <p class="info">{t('str_supplements_answer')}</p>}
          <p class="small">{t('plan_own')}</p>
        </section>
      )}

      {plan.habits.length > 0 && (
        <ul class="habits">
          {plan.habits.map((h) => (
            <li key={h.id} class="card">
              <span>{t('habit_sentence', { cue: h.cue, action: h.action })}</span>
              <button class="linkbtn" onClick={() => remove(h.id)}>{t('habit_remove')}</button>
            </li>
          ))}
        </ul>
      )}
      <p class="small" aria-live="polite">{t('ifthen_count', { n: plan.habits.length })}</p>

      {!full && (
        answered ? (
          <button class="linkbtn" onClick={() => go('habitq')}>{t('hq_answered')}</button>
        ) : (
          <section class="card" aria-labelledby="hq-h">
            <h2 id="hq-h" class="h3">{t('hq_intro_title')}</h2>
            <p class="small">{t('hq_intro')}</p>
            <button class="btn ghost" onClick={() => go('habitq')}>{t('hq_start')}</button>
          </section>
        )
      )}

      {full ? (
        <p class="info">{t('ifthen_full')}</p>
      ) : (
        <section class="card" aria-labelledby="ifthen-h">
          <h2 id="ifthen-h">{t('ifthen_title')}</h2>
          <p class="small">{t('ifthen_why')}</p>
          <div class="field">
            <label for="cue"><span class="lt">{t('ifthen_when')}</span></label>
            <div class="inputrow"><input id="cue" value={cue} maxLength={120} placeholder={t('ifthen_cue_ph')} onInput={(e) => setCue((e.target as HTMLInputElement).value)} /></div>
            <div class="chips">
              {cues.map((c) => <button key={c} class="pill" aria-pressed={cue === c} onClick={() => setCue(c)}>{c}</button>)}
            </div>
          </div>
          <div class="field">
            <label for="action"><span class="lt">{t('ifthen_will')}</span></label>
            <div class="inputrow"><input id="action" value={action} maxLength={160} placeholder={t('ifthen_action_ph')} onInput={(e) => setAction((e.target as HTMLInputElement).value)} /></div>
          </div>
          {!keeping && <p class="small">{t('ifthen_keep_note')}</p>}
          <button class="btn" onClick={save}>{t(keeping ? 'ifthen_save' : 'ifthen_save_keep')}</button>
        </section>
      )}
      {msg && <p class="small" role="status">{msg}</p>}

      {plan.habits.length > 0 && (
        <div class="stack">
          <button class="btn ghost" onClick={() => go('retest')}>{t('retest_btn')}</button>
          <button class="btn ghost" onClick={() => go('today')}>{t('today_btn')}</button>
        </div>
      )}
    </>
  );
}
