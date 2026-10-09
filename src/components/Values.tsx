import { useApp } from '../app';
import { markers, pack } from '../content';
import type { MarkerId } from '../content/types';
import { formatNumber, unitLabel } from '../lib/i18n';
import type { Safety, StoredValue } from '../lib/model';
import { calculate } from '../lib/units';

/** The person's numbers as a plain list; values shown in mmol/L with any conversion noted. */
export function ValueRows({ values, onEdit }: { values: Partial<Record<MarkerId, StoredValue>>; onEdit?: (id: MarkerId) => void }) {
  const { t, lang } = useApp();
  const mmol = unitLabel(lang, 'mmol/L');
  const calc = calculate({ total: values.total?.canonicalMmol, hdl: values.hdl?.canonicalMmol });
  const calcRows = pack.calculated
    .filter((c) => calc[c.id] !== undefined)
    .map((c) => ({ id: c.id, name: c.names[lang], value: calc[c.id]!, isIndex: c.id === 'athero_index' }));

  return (
    <div class="rows">
      {markers.filter((m) => values[m.id]).map((m) => {
        const v = values[m.id]!;
        const decimals = v.unit === 'mmol/L' ? Math.max(1, decimalsOf(v.entered)) : 2;
        return (
          <div class="row" key={m.id}>
            <span class="nm">
              {m.names[lang]}
              <small lang={lang === 'lt' ? 'en' : 'lt'}>{lang === 'lt' ? m.names.en : m.lab_names.lt}</small>
              {v.unit === 'mg/dL' && (
                <small>{t('converted_from', { value: formatNumber(v.entered, lang), unit: unitLabel(lang, 'mg/dL') })}</small>
              )}
            </span>
            <span class="v">{formatNumber(v.canonicalMmol, lang, decimals, decimals)} <small>{mmol}</small></span>
            {onEdit && (
              <span class="act"><button class="linkbtn" onClick={() => onEdit(m.id)} aria-label={`${t('edit')}: ${m.names[lang]}`}>{t('edit')}</button></span>
            )}
          </div>
        );
      })}
      {calcRows.map((c) => (
        <div class="row" key={c.id}>
          <span class="nm">{c.name}<small>{t('calculated')}</small></span>
          <span class="v">{formatNumber(c.value, lang, 1, 1)}{!c.isIndex && <small>{mmol}</small>}</span>
        </div>
      ))}
    </div>
  );
}

function decimalsOf(n: number): number {
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : Math.min(2, s.length - i - 1);
}

export function AnswerRows({ safety }: { safety: Safety }) {
  const { t } = useApp();
  const label = (v: string | null) =>
    v === null ? t('ans_none') : t({ yes: 'ans_yes', no: 'ans_no', not_sure: 'ans_not_sure', dont_know: 'ans_dont_know' }[v] ?? 'ans_none');
  const rows: [string, string | null][] = [
    ['lbl_med', safety.cholMedicine],
    ['lbl_family', safety.familyEarlyCHD],
    ['lbl_known', safety.knownCvdDiabetesCkd],
    ['lbl_pregnant', safety.pregnant],
  ];
  return (
    <div class="rows">
      {rows.map(([k, v]) => (
        <div class="row" key={k}>
          <span class="nm">{t(k)}</span>
          <span class="v">{label(v)}</span>
        </div>
      ))}
    </div>
  );
}
