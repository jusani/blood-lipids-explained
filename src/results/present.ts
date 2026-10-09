import { pack } from '../content';
import type { Lang } from '../content/types';
import { formatNumber, unitLabel } from '../lib/i18n';
import type { MarkerResult, ValueId } from '../lib/rules';
import { guidelineRange } from '../lib/rules';

export const markerName = (id: ValueId, lang: Lang): string =>
  (pack.markers.find((m) => m.id === id) ?? pack.calculated.find((c) => c.id === id))!.names[lang];

/** "5,3 mmol/L" or, when typed in mg/dL, "5,3 mmol/L (205 mg/dL)". The ratio has no unit. */
export function valueText(m: MarkerResult, lang: Lang): string {
  if (m.id === 'athero_index') return formatNumber(m.mmol, lang, 1, 1);
  const main = `${formatNumber(m.mmol, lang, m.decimals, m.decimals)} ${unitLabel(lang, 'mmol/L')}`;
  return m.mg !== null ? `${main} (${formatNumber(m.mg, lang, 0)} ${unitLabel(lang, 'mg/dL')})` : main;
}

/** "< 2,6" style guideline range, or null when the guidelines set none. */
export function rangeText(id: ValueId, lang: Lang): string | null {
  const r = guidelineRange(id);
  return r ? `${r.op} ${formatNumber(r.value, lang, 1, 1)}` : null;
}

/** Heading for each doctor card (flag ids from the evidence pack). */
export const CARD_HEAD: Record<string, string> = {
  tg_very_high: 'flag_head_tg_very_high',
  tg_high: 'flag_head_tg_high',
  fh_by_ldl: 'flag_head_ldl',
  fh_by_ldl_on_medicine: 'flag_head_ldl',
  fh_by_total: 'flag_head_total',
  fh_by_family: 'flag_head_family',
};

/** Short source name for "From {source}:": the title sentence of the citation. */
export function sourceTitle(citation: string): string {
  const parts = citation.split('. ');
  return (parts[1] ?? parts[0]).replace(/\.$/, '');
}

/** When a pack lacks a language (2026.1 was EN only), say so when reading in it. */
export const contentLacksLang = (lang: Lang) => !pack.manifest.languages.includes(lang);
