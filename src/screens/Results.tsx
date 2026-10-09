import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../app';
import { pack, packSigned } from '../content';
import { formatDate } from '../lib/i18n';
import { offersPlan, runRules, type ValueId } from '../lib/rules';
import * as store from '../lib/store';
import { AnswerRows } from '../components/Values';
import { TrustLine } from '../components/TrustLine';
import { Statement } from '../components/Statement';
import { RangeBar } from '../components/RangeBar';
import { DoctorCards } from '../results/DoctorCards';
import { BeforeAfter, previousPanel } from '../results/BeforeAfter';
import { contentLacksLang, markerName, rangeText, valueText } from '../results/present';

// Results (designer §13.5, now permanent): doctor cards first, then the headline, then each
// value on its guideline range bar. No status labels or verdicts (status_labels: false).
export function Results() {
  const { t, lang, current, isSaved, keepPanel, backTo, go, refreshSaved, setCurrent, resetDraft, setDetail, saved: savedPanels, plan } = useApp();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const r = useMemo(() => (current ? runRules(current) : null), [current]);
  if (!current || !r) {
    return (
      <>
        <h1 tabIndex={-1}>{t('results_values_heading')}</h1>
        <button class="btn" onClick={() => backTo('welcome')}>{t('home')}</button>
      </>
    );
  }
  const saved = isSaved(current.id);
  const date = current.testDate ? formatDate(current.testDate, lang) : t('date_not_known');
  const open = (id: ValueId) => { setDetail(id); go('detail'); };

  const remove = async () => {
    await store.deletePanel(current.id);
    await refreshSaved();
    setCurrent(null);
    backTo('welcome');
  };

  const big = (['ldl', 'non_hdl'] as ValueId[]).filter((id) => r.markers[id]);
  const rows = (['total', 'hdl', 'tg'] as ValueId[]).filter((id) => r.markers[id]);
  const ratio = r.markers.athero_index;
  const prev = previousPanel(current, savedPanels);
  // A plan is offered when a value is outside its guideline range, never in pregnancy or for
  // someone else's results (designer S6, QA G1, G22; helper results are not tracked).
  const offerPlan = offersPlan(r.outOfRange) && !r.hidden.has('plan') && current.mode === 'self';

  return (
    <>
      <h1 tabIndex={-1} class="pretitle">{t('results_title', { date })}</h1>
      <DoctorCards r={r} />
      <p class="headline">{t(r.headline === 'doctor' ? 'results_headline_doctor' : 'results_headline_neutral')}</p>
      <Statement />
      {r.infoNotes.filter((n) => !n.effect?.suppress_status || !big.length).map((n) => <p class="info" key={n.id}>{t(n.card)}</p>)}
      {current.safety.cholMedicine === 'yes' && <p class="info">{t('medicine_note')}</p>}
      {lang === 'lt' && contentLacksLang('lt') && <p class="small">{t('lt_fallback_note')}</p>}

      {big.map((id, i) => {
        const m = r.markers[id]!;
        return (
          <section class="card mcard" key={id} aria-labelledby={`m-${id}`}>
            {i === 0 && id === 'ldl' && <p class="dcard-label">{t('most_important')}</p>}
            <h2 id={`m-${id}`} class="mhead"><span>{markerName(id, lang)}</span><span class="v">{valueText(m, lang)}</span></h2>
            {m.suppressed ? (
              <p>{t('note_doctor_sets_target')}</p>
            ) : (
              <>
                <RangeBar m={m} />
                {m.guidelineText && <p class="small">{t(m.guidelineText)}</p>}
              </>
            )}
            {m.notes.map((n) => <p class="info" key={n.id}>{t(n.card)}</p>)}
            <button class="linkbtn" onClick={() => open(id)}>{t('detail_open')}</button>
          </section>
        );
      })}

      {rows.length > 0 && (
        <section class="stack" aria-labelledby="other-h">
          <h2 id="other-h">{t('other_numbers')}</h2>
          <div class="rows">
            {rows.map((id) => {
              const m = r.markers[id]!;
              const range = rangeText(id, lang);
              return (
                <div class="row" key={id}>
                  <button class="rowlink" onClick={() => open(id)}>
                    <span class="nm">{markerName(id, lang)}{range && <small>{t('guideline_ranges')}: {range}</small>}</span>
                    <span class="v">{valueText(m, lang)} <span class="chev" aria-hidden="true">›</span></span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {ratio && (
        <details class="card">
          <summary>{t('more_numbers')}</summary>
          <div class="row"><span class="nm">{markerName('athero_index', lang)}</span><span class="v">{valueText(ratio, lang)}</span></div>
          <p class="small">{t('str_athero_no_range')}</p>
        </details>
      )}

      {prev && <BeforeAfter r={r} prev={prev} />}

      {offerPlan && (
        <section class="card" aria-labelledby="plan-h">
          <h2 id="plan-h">{t('plan_offer_title')}</h2>
          <p>{t('plan_offer_body')}</p>
          <button class="btn" onClick={() => go('plan')}>{t(plan.habits.length ? 'plan_edit' : 'plan_btn')}</button>
          {plan.habits.length > 0 && <button class="btn ghost" onClick={() => go('today')}>{t('today_btn')}</button>}
        </section>
      )}

      <h2>{t('answers_heading')}</h2>
      <AnswerRows safety={current.safety} />

      <div class="stack">
        {saved ? (
          <p class="small" role="status">{t('saved_note')}</p>
        ) : (
          <>
            <p class="small">{t('not_saved_note')}</p>
            <button class="btn ghost" onClick={() => keepPanel(current)}>{t('keep_quiet')}</button>
          </>
        )}
        {current.mode === 'helper' && <p class="small">{t('helper_track_note')}</p>}
      </div>

      {r.doctorCards.length === 0 && <button class="btn ghost" onClick={() => go('summary')}>{t('get_summary')}</button>}
      <button class="linkbtn" onClick={() => go('share')}>{t('share_prompt')}</button>
      <button class="btn" onClick={() => { resetDraft(); setCurrent(null); backTo('welcome'); }}>{t('start_over')}</button>

      {saved && !confirmRemove && (
        <button class="linkbtn" onClick={() => setConfirmRemove(true)}>{t('remove_result')}</button>
      )}
      {saved && confirmRemove && (
        <div class="confirm-del" role="group">
          <p>{t('remove_confirm')}</p>
          <button class="btn danger" onClick={remove}>{t('remove_yes')}</button>
          <button class="btn ghost" onClick={() => setConfirmRemove(false)}>{t('cancel')}</button>
        </div>
      )}

      <TrustLine />
      <p class="small">{t('content_version', { version: pack.manifest.version })}{!packSigned && ` · ${t('content_unchecked')}`}</p>
    </>
  );
}
