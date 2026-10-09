import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp } from '../app';
import { markers, packSigned } from '../content';
import type { MarkerId, MeasuredMarker, Unit } from '../content/types';
import { answerField, checkDraft, setDefaultUnit, setFieldText, todayIso, type Resolved } from '../lib/entry';
import { formatNumber, unitLabel } from '../lib/i18n';
import { toMmol, type AskOption } from '../lib/units';
import { LabGuide } from '../components/LabGuide';

const EXAMPLE: Record<MarkerId, string> = { ldl: '4,1', total: '6,3', hdl: '1,3', tg: '2,2' };

export function Entry() {
  const { t, lang, draft, setDraft, go } = useApp();
  const [guideFor, setGuideFor] = useState<MarkerId | null>(null);
  const check = checkDraft(draft);
  const inputs = useRef<Partial<Record<MarkerId, HTMLInputElement | null>>>({});
  const [focusAfter, setFocusAfter] = useState<MarkerId | null>(null);

  useEffect(() => {
    if (focusAfter) { inputs.current[focusAfter]?.focus(); setFocusAfter(null); }
  }, [focusAfter]);

  const fmt = (v: number) => formatNumber(v, lang);
  const u = (unit: Unit) => unitLabel(lang, unit);

  const onAnswer = (id: MarkerId, o: AskOption) => {
    setDraft((d) => answerField(d, id, o, fmt));
    if (o.kind === 'retype') setFocusAfter(id);
  };

  const okNames = markers.filter((m) => check.resolved[m.id].state === 'ok').map((m) => m.names[lang]);
  const reason = !check.ready
    ? check.hasAsk || check.swapped ? t('continue_answer_first') : !check.hasMinimum ? t('continue_needs') : check.hasInvalid ? t('err_not_number') : ''
    : '';

  const fillExample = () => {
    let d = setDefaultUnit(draft, 'mmol/L');
    for (const m of markers) d = setFieldText(d, m.id, lang === 'lt' ? EXAMPLE[m.id] : EXAMPLE[m.id].replace(',', '.'));
    setDraft({ ...d, testDate: todayIso(), dateUnknown: false });
  };

  return (
    <>
      <h1 tabIndex={-1}>{t('entry_title')}</h1>
      <p class="small">{t('entry_order_note')}</p>
      {!packSigned && (
        <button class="linkbtn" onClick={fillExample}>{t('fill_example')}</button>
      )}

      <div class="stack">
        <span class="small" id="unit-label">{t('unit_label')}</span>
        <div class="seg" role="group" aria-labelledby="unit-label">
          {(['mmol/L', 'mg/dL'] as Unit[]).map((unit) => (
            <button key={unit} aria-pressed={draft.defaultUnit === unit} onClick={() => setDraft((d) => setDefaultUnit(d, unit))}>
              {u(unit)}
            </button>
          ))}
        </div>
      </div>

      {markers.map((m) => (
        <Field
          key={m.id}
          marker={m}
          resolved={check.resolved[m.id]}
          inputRef={(el) => { inputs.current[m.id] = el; }}
          onAnswer={(o) => onAnswer(m.id, o)}
          onGuide={() => setGuideFor(m.id)}
          othersUnit={othersLookLike(m.id, check.resolved, draft.defaultUnit)}
        />
      ))}

      <div class="field">
        <label for="test-date"><span class="lt">{t('test_date_label')}</span></label>
        <input
          id="test-date"
          class="dateinput"
          type="date"
          max={todayIso()}
          value={draft.dateUnknown ? '' : draft.testDate}
          disabled={draft.dateUnknown}
          onInput={(e) => setDraft({ ...draft, testDate: (e.target as HTMLInputElement).value })}
        />
        <label class="check">
          <input
            type="checkbox"
            checked={draft.dateUnknown}
            onChange={(e) => setDraft({ ...draft, dateUnknown: (e.target as HTMLInputElement).checked })}
          />
          {t('date_unknown')}
        </label>
      </div>

      {check.swapped && (
        <div class="askbox" role="group" aria-live="polite">
          <p>{t('cross_check')}</p>
          <div class="opts">
            <button class="pill" onClick={() => setDraft({ ...draft, crossAcknowledgedFor: check.swapKey })}>{t('cross_ok')}</button>
          </div>
        </div>
      )}

      <div class="stack">
        <button class="btn" disabled={!check.ready} onClick={() => go('safety')} aria-describedby="continue-why">
          {check.ready ? t('continue_with', { list: okNames.join(', ') }) : t('continue')}
        </button>
        <p id="continue-why" class="small" aria-live="polite">{reason}</p>
      </div>

      <LabGuide marker={guideFor} onClose={() => setGuideFor(null)} />
    </>
  );
}

/** "Your other numbers look like mmol/L": only when every other filled field reads fine in the panel unit. */
function othersLookLike(id: MarkerId, resolved: Record<MarkerId, Resolved>, unit: Unit): Unit | null {
  const others = markers.filter((m) => m.id !== id).map((m) => resolved[m.id]).filter((r) => r.state !== 'empty');
  if (others.length === 0) return null;
  return others.every((r) => r.state === 'ok' && r.unit === unit) ? unit : null;
}

interface FieldProps {
  marker: MeasuredMarker;
  resolved: Resolved;
  inputRef: (el: HTMLInputElement | null) => void;
  onAnswer: (o: AskOption) => void;
  onGuide: () => void;
  othersUnit: Unit | null;
}

function Field({ marker, resolved, inputRef, onAnswer, onGuide, othersUnit }: FieldProps) {
  const { t, lang, draft, setDraft } = useApp();
  const f = draft.fields[marker.id];
  const id = `f-${marker.id}`;
  const fmt = (v: number) => formatNumber(v, lang);
  const u = (unit: Unit) => unitLabel(lang, unit);
  const lead = lang === 'lt' ? marker.lab_names.lt : marker.lab_names.en;
  const second = lang === 'lt' ? marker.lab_names.en : marker.lab_names.lt;
  const ownUnit = f.unit !== draft.defaultUnit;

  const optionLabel = (o: AskOption): string => {
    switch (o.kind) {
      case 'retype': return t('opt_retype');
      case 'decimal': return `${fmt(o.value)} ${u(o.unit)}`;
      case 'as_typed':
        return resolved.state === 'ask' && resolved.ask.reason === 'decimals'
          ? t('opt_right_as_typed')
          : t('opt_as_typed', { value: fmt(o.value), unit: u(o.unit) });
      case 'other_unit': {
        if (o.unit === 'mg/dL') {
          const mmol = toMmol(o.value, 'mg/dL', marker);
          return `${fmt(o.value)} ${u('mg/dL')} (${formatNumber(mmol, lang, 2)} ${u('mmol/L')})`;
        }
        return `${fmt(o.value)} ${u('mmol/L')}`;
      }
    }
  };

  let askText: string[] = [];
  if (resolved.state === 'ask') {
    const a = resolved.ask;
    const value = fmt(resolved.value);
    if (a.reason === 'decimals') askText = [t('ask_decimals')];
    else if (a.reason === 'ambiguous') askText = [t('ask_tg_ambiguous', { value })];
    else {
      askText = [t('ask_unusual', { value, marker: marker.names[lang], unit: u(f.unit) })];
      const suggestsOther = a.options.some((o) => o.kind === 'other_unit');
      if (suggestsOther && othersUnit) askText.push(t('ask_others_look', { unit: u(othersUnit) }));
      askText.push(t('ask_which'));
    }
  }

  const describedBy = [`${id}-hint`, resolved.state === 'ask' ? `${id}-ask` : '', resolved.state === 'invalid' ? `${id}-err` : '']
    .filter(Boolean).join(' ');

  return (
    <div class="field">
      <label for={id}>
        <span class="lt">{lead}</span>
        <span class="en">{second}</span>
      </label>
      <div class={`inputrow ${resolved.state === 'ask' ? 'ask' : ''} ${resolved.state === 'invalid' ? 'err' : ''}`}>
        <input
          id={id}
          ref={inputRef}
          inputMode="decimal"
          autocomplete="off"
          enterKeyHint="next"
          value={f.text}
          aria-invalid={resolved.state === 'invalid' || resolved.state === 'ask'}
          aria-describedby={describedBy}
          onInput={(e) => setDraft((d) => setFieldText(d, marker.id, (e.target as HTMLInputElement).value))}
        />
        <span class={`u ${ownUnit ? 'own' : ''}`}>{u(f.unit)}</span>
      </div>
      <div class="hint" id={`${id}-hint`}>
        {resolved.state === 'ok' && (
          <span>
            {t('read_as', { value: fmt(resolved.value) })}
            {resolved.unit === 'mg/dL' && ` = ${formatNumber(resolved.mmol, lang, 2)} ${u('mmol/L')}`}
          </span>
        )}
        {f.decimalFixedFrom !== undefined && resolved.state === 'ok' && (
          <span>({t('decimal_fixed_from', { value: fmt(f.decimalFixedFrom) })})</span>
        )}
        <button class="linkbtn" onClick={onGuide}>{t('where_find')}</button>
      </div>
      {resolved.state === 'invalid' && <p class="err-text" id={`${id}-err`}>{t('err_not_number')}</p>}
      {resolved.state === 'ask' && (
        <div class="askbox" id={`${id}-ask`} role="group" aria-label={lead}>
          {askText.map((s, i) => <p key={i}>{s}</p>)}
          <div class="opts">
            {resolved.ask.options.map((o, i) => (
              <button key={i} class="pill" onClick={() => onAnswer(o)}>{optionLabel(o)}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

