import { useApp } from '../app';
import { formatDate, formatNumber } from '../lib/i18n';
import type { Panel } from '../lib/model';
import { runRules, type RulesResult, type ValueId } from '../lib/rules';
import { RangeBar } from '../components/RangeBar';
import { markerName, valueText } from './present';

const when = (p: Panel) => p.testDate ?? p.enteredAt.slice(0, 10);

/** The most recent saved panel from before this one, same person mode. */
export function previousPanel(current: Panel, saved: Panel[]): Panel | null {
  return saved
    .filter((p) => p.id !== current.id && p.mode === current.mode && when(p) < when(current))
    .sort((a, b) => when(b).localeCompare(when(a)))[0] ?? null;
}

// S16 before and after: both numbers and the difference only. No verdict on the change,
// no "good result", no attribution to habits (QA M1, G24).
export function BeforeAfter({ r, prev }: { r: RulesResult; prev: Panel }) {
  const { t, lang } = useApp();
  const old = runRules(prev);
  const date = prev.testDate ? formatDate(prev.testDate, lang) : formatDate(prev.enteredAt.slice(0, 10), lang);
  const ids = (['ldl', 'non_hdl', 'total', 'hdl', 'tg'] as ValueId[]).filter((id) => r.markers[id] && old.markers[id]);
  if (!ids.length) return null;
  return (
    <section class="stack" aria-labelledby="ba-h">
      <h2 id="ba-h">{t('ba_title')}</h2>
      {ids.map((id) => {
        const now = r.markers[id]!, was = old.markers[id]!;
        const dec = Math.max(now.decimals, was.decimals);
        const diff = Math.abs(now.mmol - was.mmol);
        const same = Number(diff.toFixed(dec)) === 0;
        const key = same ? 'ba_same' : now.mmol < was.mmol ? 'ba_lower' : 'ba_higher';
        const vars = { marker: markerName(id, lang), now: valueText(now, lang), before: valueText(was, lang), diff: formatNumber(diff, lang, dec, dec), date };
        return (
          <div class="card" key={id}>
            <p>{t(key, vars)}</p>
            {!now.suppressed && (
              <>
                <RangeBar m={now} before={was.mmol} label={t('ba_bar_label', vars)} />
                <p class="small" aria-hidden="true">{t('ba_key')}</p>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
