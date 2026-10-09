import { useApp } from '../app';
import { pack } from '../content';
import { formatNumber } from '../lib/i18n';
import { intervals, type MarkerResult } from '../lib/rules';
import { markerName } from '../results/present';

/**
 * The value on the guideline range bar (designer §13.5): zones drawn from the content pack,
 * shaded by guideline (not by verdict), one marker for the value. No status words.
 */
export function RangeBar({ m, before, label }: { m: MarkerResult; before?: number; label?: string }) {
  const { t, lang } = useApp();
  const scale = pack.bar_scale[m.id];
  if (!scale || !m.zones.length) return null;
  const span = scale.max - scale.min;
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - scale.min) / span) * 100));
  const iv = intervals(m.zones, false);
  const segs = m.zones.map((z, i) => ({ z, lo: pos(Math.max(iv[i].lo, scale.min)), hi: pos(Math.min(iv[i].hi, scale.max)) }));
  const above = m.mmol > scale.max;
  const ticks = iv.slice(1).map((r) => r.lo).filter((v) => Number.isFinite(v) && v < scale.max);
  // Ticks closer than 10% of the bar drop to a second line so their labels never overlap.
  const low: boolean[] = [];
  ticks.forEach((v, i) => { low[i] = i > 0 && !low[i - 1] && pos(v) - pos(ticks[i - 1]) < 10; });
  const value = formatNumber(m.mmol, lang, m.decimals, m.decimals);
  return (
    <div class={`rbar${low.some(Boolean) ? ' two' : ''}`} role="img" aria-label={label ?? t('bar_label', { marker: markerName(m.id, lang), value })}>
      <div class="rbar-track">
        {segs.map((s, i) => (
          <span key={i} class={`rbar-seg z-${s.z.status}`} style={{ left: `${s.lo}%`, width: `${s.hi - s.lo}%` }} />
        ))}
        {before !== undefined && <span class="rbar-dot before" style={{ left: `${pos(before)}%` }} />}
        <span class="rbar-dot" style={{ left: `${pos(m.mmol)}%` }} />
      </div>
      <div class="rbar-ticks" aria-hidden="true">
        {ticks.map((v, i) => (
          <span key={v} class={low[i] ? 'low' : ''} style={{ left: `${pos(v)}%` }}>
            {formatNumber(v, lang, 1, 1)}
          </span>
        ))}
      </div>
      {above && <p class="small">{value} · {t('scale_above')}</p>}
    </div>
  );
}
