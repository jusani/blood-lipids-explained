import { useApp } from '../app';
import type { RuleFlag } from '../content/types';
import type { RulesResult } from '../lib/rules';
import { CARD_HEAD, markerName, valueText } from './present';
import { pack } from '../content';

/** The cards about inherited high cholesterol, by family history or by value (content 2026.5 family note). */
const FH_CARDS = new Set(['fh_by_family', 'fh_by_ldl', 'fh_by_ldl_on_medicine', 'fh_by_total']);

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
      {FH_CARDS.has(f.id) && pack.strings.str_family_testing_prompt && (
        // Results only, never the doctor summary (QA L1). The share screen sends text and a link, no values.
        <div class="family">
          <p>{t('str_family_testing_prompt')}</p>
          <button class="btn ghost" onClick={() => go('share')}>{t('str_share_with_relative')}</button>
        </div>
      )}
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
