import { useMemo } from 'preact/hooks';
import { useApp } from '../app';
import { pack } from '../content';
import { runRules } from '../lib/rules';
import { RangeBar } from '../components/RangeBar';
import { Statement } from '../components/Statement';
import { TrustLine } from '../components/TrustLine';
import { contentLacksLang, markerName, valueText } from '../results/present';
import { SourceQuotes } from '../components/SourceQuotes';

// S7 marker detail: the bar, the guideline's own zone names, the guideline text and the
// quoted source lines with links. No status chip (designer §13.5).
export function MarkerDetail() {
  const { t, lang, current, detail, back } = useApp();
  const r = useMemo(() => (current ? runRules(current) : null), [current]);
  const m = detail && r?.markers[detail];
  if (!m) {
    return (
      <>
        <h1 tabIndex={-1}>{t('detail_sources')}</h1>
        <button class="btn" onClick={back}>{t('back')}</button>
      </>
    );
  }
  const claimIds = [...m.zones.map((z) => z.claim), ...m.notes.map((n) => n.claim)];
  const hasQuotes = claimIds.some((id) => pack.rules.claims.find((c) => c.id === id)?.quotes?.length);

  return (
    <>
      <h1 tabIndex={-1} class="mhead"><span>{markerName(m.id, lang)}</span><span class="v">{valueText(m, lang)}</span></h1>
      <Statement />
      {lang === 'lt' && contentLacksLang('lt') && <p class="small">{t('lt_fallback_note')}</p>}
      {m.suppressed ? (
        <p class="info">{t('note_doctor_sets_target')}</p>
      ) : (
        <>
          <RangeBar m={m} />
          {m.zone >= 0 && <p>{t('value_sits', { zone: t(m.zones[m.zone].label) })}</p>}
          {m.zones.length > 0 && (
            <section aria-labelledby="zones-h">
              <h2 id="zones-h">{t('guideline_ranges')}</h2>
              <ul class="zones">
                {m.zones.map((z, i) => (
                  <li key={z.label} class={`z-${z.status}`} aria-current={i === m.zone ? 'true' : undefined}>{t(z.label)}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {m.guidelineText && !m.suppressed && <p>{t(m.guidelineText)}</p>}
      {m.notes.map((n) => <p class="info" key={n.id}>{t(n.card)}</p>)}

      {hasQuotes && (
        <section class="stack" aria-labelledby="src-h">
          <h2 id="src-h">{t('detail_sources')}</h2>
          <SourceQuotes claimIds={claimIds} />
        </section>
      )}
      <TrustLine />
    </>
  );
}
