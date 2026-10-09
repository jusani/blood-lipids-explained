// State of the entry form and how each field resolves to a usable value.

import { markerById, markers, pack } from '../content';
import type { MarkerId, Unit } from '../content/types';
import { emptySafety, newId, type Panel, type Safety, type StoredValue } from './model';
import { assessField, looksSwapped, parseInput, toMmol, type Ask, type AskOption } from './units';

export interface FieldState {
  text: string;
  unit: Unit;
  unitConfirmedBy: 'default' | 'person_answered_prompt';
  /** The text the person answered a prompt for; a new text asks again. */
  answeredFor?: string;
  decimalFixedFrom?: number;
}

export interface Draft {
  defaultUnit: Unit;
  fields: Record<MarkerId, FieldState>;
  testDate: string;          // YYYY-MM-DD
  dateUnknown: boolean;
  safety: Safety;
  helperName: string;
  crossAcknowledgedFor?: string;
  /** Set when the explanation is first shown, so going back and editing updates the same panel. */
  panelId?: string;
}

export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function emptyDraft(): Draft {
  const fields = {} as Record<MarkerId, FieldState>;
  for (const m of markers) fields[m.id] = { text: '', unit: 'mmol/L', unitConfirmedBy: 'default' };
  return { defaultUnit: 'mmol/L', fields, testDate: todayIso(), dateUnknown: false, safety: { ...emptySafety }, helperName: '' };
}

export type Resolved =
  | { state: 'empty' }
  | { state: 'invalid' }
  | { state: 'ask'; ask: Ask; value: number }
  | { state: 'ok'; value: number; unit: Unit; usedComma: boolean; mmol: number };

export function resolveField(id: MarkerId, f: FieldState): Resolved {
  const p = parseInput(f.text);
  if (p.kind === 'empty') return { state: 'empty' };
  if (p.kind === 'invalid') return { state: 'invalid' };
  const marker = markerById[id];
  const ok: Resolved = { state: 'ok', value: p.value, unit: f.unit, usedComma: p.usedComma, mmol: toMmol(p.value, f.unit, marker) };
  if (f.answeredFor === f.text) return ok;
  const ask = assessField(p.value, p.decimals, f.unit, marker);
  return ask ? { state: 'ask', ask, value: p.value } : ok;
}

/** Changing the text drops any earlier answer for that field (and its per-field unit). */
export function setFieldText(d: Draft, id: MarkerId, text: string): Draft {
  return {
    ...d,
    fields: { ...d.fields, [id]: { text, unit: d.defaultUnit, unitConfirmedBy: 'default' } },
  };
}

/** The panel unit switch: only fields still on the default follow it (QA B5a). */
export function setDefaultUnit(d: Draft, unit: Unit): Draft {
  const fields = { ...d.fields };
  for (const id of Object.keys(fields) as MarkerId[]) {
    if (fields[id].unitConfirmedBy === 'default') fields[id] = { ...fields[id], unit, answeredFor: undefined };
  }
  return { ...d, defaultUnit: unit, fields };
}

/** Apply the person's answer to one field's question. Never touches other fields. */
export function answerField(d: Draft, id: MarkerId, option: AskOption, formatted: (v: number) => string): Draft {
  const f = d.fields[id];
  if (option.kind === 'retype') return setFieldText(d, id, '');
  if (option.kind === 'decimal') {
    const text = formatted(option.value);
    const from = parseInput(f.text);
    return {
      ...d,
      fields: {
        ...d.fields,
        [id]: {
          text, unit: option.unit, unitConfirmedBy: 'person_answered_prompt', answeredFor: text,
          decimalFixedFrom: from.kind === 'number' ? from.value : undefined,
        },
      },
    };
  }
  return {
    ...d,
    fields: { ...d.fields, [id]: { ...f, unit: option.unit, unitConfirmedBy: 'person_answered_prompt', answeredFor: f.text } },
  };
}

export interface DraftCheck {
  resolved: Record<MarkerId, Resolved>;
  hasInvalid: boolean;
  hasAsk: boolean;
  hasMinimum: boolean;
  swapped: boolean;
  swapKey: string;
  ready: boolean;
}

export function checkDraft(d: Draft): DraftCheck {
  const resolved = {} as Record<MarkerId, Resolved>;
  for (const m of markers) resolved[m.id] = resolveField(m.id, d.fields[m.id]);
  const vals = Object.values(resolved);
  const hasInvalid = vals.some((r) => r.state === 'invalid');
  const hasAsk = vals.some((r) => r.state === 'ask');
  const mmol = (id: MarkerId) => { const r = resolved[id]; return r.state === 'ok' ? r.mmol : undefined; };
  // QA A1/E2: LDL, total (alone is fine) or TG.
  const hasMinimum = (['ldl', 'total', 'tg'] as MarkerId[]).some((id) => resolved[id].state === 'ok');
  const trio = { ldl: mmol('ldl'), total: mmol('total'), hdl: mmol('hdl') };
  const swapped = !hasAsk && looksSwapped(trio);
  const swapKey = JSON.stringify(trio);
  const swapOpen = swapped && d.crossAcknowledgedFor !== swapKey;
  return { resolved, hasInvalid, hasAsk, hasMinimum, swapped: swapOpen, swapKey, ready: hasMinimum && !hasInvalid && !hasAsk && !swapOpen };
}

export function buildPanel(d: Draft, mode: 'self' | 'helper', now = new Date()): Panel {
  const { resolved } = checkDraft(d);
  const values: Panel['values'] = {};
  for (const m of markers) {
    const r = resolved[m.id];
    if (r.state !== 'ok') continue;
    const f = d.fields[m.id];
    const v: StoredValue = { entered: r.value, unit: r.unit, canonicalMmol: r.mmol, unitConfirmedBy: f.unitConfirmedBy };
    if (f.decimalFixedFrom !== undefined) v.decimalFixedFrom = f.decimalFixedFrom;
    values[m.id] = v;
  }
  const p: Panel = {
    id: d.panelId ?? newId(),
    testDate: d.dateUnknown ? null : d.testDate || null,
    enteredAt: now.toISOString(),
    defaultUnit: d.defaultUnit,
    values,
    safety: { ...d.safety },
    mode,
    contentVersionSeen: pack.manifest.version,
    source: 'manual',
  };
  if (mode === 'helper' && d.helperName.trim()) p.helperName = d.helperName.trim().slice(0, 60);
  return p;
}
