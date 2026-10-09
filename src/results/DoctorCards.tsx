import { useApp } from '../app';
import type { RuleFlag } from '../content/types';
import type { RulesResult } from '../lib/rules';
import { CARD_HEAD, markerName, valueText } from './present';

/** Doctor cards first, at most two, the rest listed by heading (designer S6, QA §18). */
export function DoctorCards({ r }: { r: RulesResult }) {
  const { t, lang, go } = useApp();
  if (!r.doctorCards.length) return null;
  const vars: Record<string, string> = {};
  for (const id of ['ldl', 'total', 'tg'] as const) if (r.markers[id]) vars[id] = valueText(r.markers[id]!, lang);
  const card = (f: RuleFlag) => (
    <section class={`dcard ${f.severity}`} key={f.id} aria-labelledby={`dc-${f.id}`}>
      <p class="dcard-label">{t('flag_label')}</p>
      <h2 id={`dc-${f.id}`}>{t(CARD_HEAD[f.id] ?? 'results_headline_doctor')}</h2>
      <p>{t(f.card, vars)}</p>
      {f.time_frame && <p class="dcard-when">{t(f.time_frame)}</p>}
    </section>
  );
  return (
    <div class="stack">
      {r.shownCards.map(card)}
      {r.overflowCards.length > 0 && (
        <div class="card">
          <p>{t('more_to_discuss')}</p>
          <ul>{r.overflowCards.map((f) => <li key={f.id}>{t(CARD_HEAD[f.id] ?? f.card)}</li>)}</ul>
        </div>
      )}
      <button class="btn" onClick={() => go('summary')}>{t('get_summary')}</button>
    </div>
  );
}

export { markerName };
