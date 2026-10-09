import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../app';
import { pack, packSigned } from '../content';
import type { Lang } from '../content/types';
import { formatDate, formatNumber, translate, unitLabel } from '../lib/i18n';
import { cardThreshold, runRules, type ValueId } from '../lib/rules';
import { markerName, rangeText, valueText } from '../results/present';

// S9 doctor summary: one A4 page, its own language, thresholds and questions only. It never
// names a condition or gives a verdict (QA §18). Neutral wording, no "my"/"your" (QA G19).
export function DoctorSummary() {
  const { t, lang, current, back } = useApp();
  const [sl, setSl] = useState<Lang>(lang);
  const r = useMemo(() => (current ? runRules(current) : null), [current]);
  if (!current || !r) {
    return (
      <>
        <h1 tabIndex={-1}>{t('summary_title')}</h1>
        <button class="btn" onClick={back}>{t('back')}</button>
      </>
    );
  }
  const s = (key: string, vars?: Record<string, string | number>) => translate(sl, 'self', key, vars);
  const order: ValueId[] = ['ldl', 'non_hdl', 'total', 'hdl', 'tg', 'athero_index'];

  // LDL: both goals the pack names, so the summary never reads as the app picking a target (QA R4).
  const ldlRange = () => {
    const z = pack.rules.markers.find((x) => x.id === 'ldl')?.zones ?? [];
    const moderate = z.find((x) => x.label === 'zone_ldl_goal_moderate')?.below;
    const low = z.find((x) => x.label === 'zone_ldl_goal_low_only')?.below;
    return low !== undefined && moderate !== undefined
      ? s('summary_range_ldl', { low: formatNumber(low, sl, 1, 1), moderate: formatNumber(moderate, sl, 1, 1) })
      : rangeText('ldl', sl) ?? s('summary_range_none');
  };

  const lines: string[] = [];
  for (const f of r.doctorCards) {
    const th = cardThreshold(f.id);
    if (th && r.markers[th.id]) {
      const m = r.markers[th.id]!;
      const threshold = m.mg !== null
        ? `${formatNumber(th.mmol, sl, 1, 1)} ${unitLabel(sl, 'mmol/L')} (${formatNumber(th.mg, sl, 0)} ${unitLabel(sl, 'mg/dL')})`
        : `${formatNumber(th.mmol, sl, 1, 1)} ${unitLabel(sl, 'mmol/L')}`;
      lines.push(s('summary_flag_line', { marker: markerName(th.id, sl), value: valueText(m, sl), threshold }));
    } else if (f.id === 'fh_by_family') {
      lines.push(s('summary_family_line'));
    }
  }
  const ans = (v: string | null) =>
    s(v === null ? 'ans_none' : ({ yes: 'ans_yes', no: 'ans_no', not_sure: 'ans_not_sure', dont_know: 'ans_dont_know' } as Record<string, string>)[v] ?? 'ans_none');
  const answers: [string, string | null][] = [
    ['lbl_med', current.safety.cholMedicine],
    ['lbl_family', current.safety.familyEarlyCHD],
    ['lbl_known', current.safety.knownCvdDiabetesCkd],
    ['lbl_pregnant', current.safety.pregnant],
  ];

  return (
    <>
      <div class="noprint stack">
        <h1 tabIndex={-1}>{t('summary_title')}</h1>
        <h2 id="sl-h">{t('summary_lang')}</h2>
        <div class="seg" role="group" aria-labelledby="sl-h">
          {(['lt', 'en'] as Lang[]).map((l) => (
            <button key={l} lang={l} aria-pressed={sl === l} onClick={() => setSl(l)}>{l === 'lt' ? 'Lietuvių' : 'English'}</button>
          ))}
        </div>
        <button class="btn" onClick={() => print()}>{t('print_btn')}</button>
      </div>

      <article class="docsheet" lang={sl}>
        <h2>{s('summary_doc_title')}</h2>
        {current.mode === 'helper' && current.helperName && <p>{s('summary_name', { name: current.helperName })}</p>}
        <p>{current.testDate ? s('summary_test_date', { date: formatDate(current.testDate, sl) }) : s('date_not_known')}</p>

        {lines.length > 0 && (
          <div class="docsheet-box">
            <h3>{s('summary_to_discuss')}</h3>
            <ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        )}

        <table>
          <thead>
            <tr><th>{s('summary_col_marker')}</th><th>{s('summary_col_result')}</th><th>{s('summary_col_range')}</th></tr>
          </thead>
          <tbody>
            {order.filter((id) => r.markers[id]).map((id) => {
              const m = r.markers[id]!;
              const range = m.suppressed ? s('summary_range_doctor') : id === 'ldl' ? ldlRange() : rangeText(id, sl) ?? s('summary_range_none');
              return <tr key={id}><td>{markerName(id, sl)}</td><td>{valueText(m, sl)}</td><td>{range}</td></tr>;
            })}
          </tbody>
        </table>

        <h3>{s('summary_answers')}</h3>
        <ul class="plain">{answers.map(([k, v]) => <li key={k}>{s(k)}: {ans(v)}</li>)}</ul>

        <h3>{s('summary_questions')}</h3>
        <ol>{r.doctorQuestions.map((q) => <li key={q}>{s(q)}</li>)}</ol>

        <p class="docsheet-foot">
          {s('summary_footer', { version: pack.manifest.version })}
          {!packSigned && ` ${s('content_unchecked')}`}
        </p>
      </article>
    </>
  );
}
