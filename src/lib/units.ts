// Units and parsing (architect.md §5.1, QA B5 and E1–E3, designer.md §13.2).
// Pure functions only, so they are easy to test.

import type { MeasuredMarker, Unit } from '../content/types';

export type Parsed =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'number'; value: number; decimals: number; usedComma: boolean };

/** Accepts "4,1" and "4.1". Rejects thousands separators, signs, spaces inside and anything else. */
export function parseInput(text: string): Parsed {
  const s = text.trim();
  if (s === '') return { kind: 'empty' };
  const m = /^(\d+)(?:([.,])(\d+))?$/.exec(s);
  if (!m) return { kind: 'invalid' };
  const decimals = m[3] ? m[3].length : 0;
  const value = Number(m[1] + (m[3] ? '.' + m[3] : ''));
  if (!Number.isFinite(value)) return { kind: 'invalid' };
  return { kind: 'number', value, decimals, usedComma: m[2] === ',' };
}

export const otherUnit = (u: Unit): Unit => (u === 'mmol/L' ? 'mg/dL' : 'mmol/L');

/** Canonical value in mmol/L, full precision. Cholesterol ÷ 38.67, TG ÷ 88.6 (evidence pack). */
export function toMmol(value: number, unit: Unit, marker: MeasuredMarker): number {
  return unit === 'mmol/L' ? value : value / marker.mg_dl_factor;
}

export function fromMmol(mmol: number, unit: Unit, marker: MeasuredMarker): number {
  return unit === 'mmol/L' ? mmol : mmol * marker.mg_dl_factor;
}

const inRange = (v: number, r: { min: number; max: number }) => v >= r.min && v <= r.max;

export function isPlausible(value: number, unit: Unit, marker: MeasuredMarker): boolean {
  return inRange(toMmol(value, unit, marker), marker.plausible);
}

function isTypical(value: number, unit: Unit, marker: MeasuredMarker): boolean {
  return inRange(toMmol(value, unit, marker), marker.typical);
}

/** Round away float noise from dividing by 10 or 100. */
const tidy = (v: number) => Math.round(v * 1e6) / 1e6;

export type AskOption =
  | { kind: 'decimal'; value: number; unit: Unit }
  | { kind: 'as_typed'; value: number; unit: Unit }
  | { kind: 'other_unit'; value: number; unit: Unit }
  | { kind: 'retype' };

export type Ask =
  | { reason: 'decimals'; options: AskOption[] }
  | { reason: 'implausible'; options: AskOption[] }
  | { reason: 'ambiguous'; options: AskOption[] };

/** A missing decimal: v/10 or v/100 that lands in the marker's typical range, same unit. */
export function decimalSuggestion(value: number, unit: Unit, marker: MeasuredMarker): number | null {
  if (value < 10) return null;
  for (const d of [10, 100]) {
    const c = tidy(value / d);
    if (isTypical(c, unit, marker)) return c;
  }
  return null;
}

/**
 * Should this one field be held and asked about? Returns null when the value can be used.
 * Never pre-selects an answer and never touches other fields or the panel unit.
 */
export function assessField(value: number, decimals: number, unit: Unit, marker: MeasuredMarker): Ask | null {
  const other = otherUnit(unit);

  if (decimals > 2) {
    const options: AskOption[] = [];
    if (isPlausible(value, unit, marker)) options.push({ kind: 'as_typed', value, unit });
    options.push({ kind: 'retype' });
    return { reason: 'decimals', options };
  }

  // TG ambiguous band (about 10–100): severe TG in mmol/L overlaps normal TG in mg/dL. Always ask.
  if (marker.ambiguous && inRange(value, marker.ambiguous)) {
    const options: AskOption[] = [];
    const dec = decimalSuggestion(value, unit, marker);
    if (dec !== null) options.push({ kind: 'decimal', value: dec, unit });
    if (isPlausible(value, unit, marker)) options.push({ kind: 'as_typed', value, unit });
    if (isPlausible(value, other, marker)) options.push({ kind: 'other_unit', value, unit: other });
    options.push({ kind: 'retype' });
    return { reason: 'ambiguous', options };
  }

  if (!isPlausible(value, unit, marker)) {
    const options: AskOption[] = [];
    const dec = decimalSuggestion(value, unit, marker);
    if (dec !== null) options.push({ kind: 'decimal', value: dec, unit });
    if (isPlausible(value, other, marker)) options.push({ kind: 'other_unit', value, unit: other });
    options.push({ kind: 'retype' });
    return { reason: 'implausible', options };
  }

  return null;
}

/**
 * QA E1: values that don't usually go together (LDL typed into HDL, etc.).
 * All inputs canonical mmol/L; missing values are skipped.
 */
export function looksSwapped(v: { ldl?: number; total?: number; hdl?: number }): boolean {
  const { ldl, total, hdl } = v;
  if (total === undefined) return false;
  if (ldl !== undefined && ldl >= total) return true;
  if (hdl !== undefined && hdl >= total) return true;
  if (ldl !== undefined && hdl !== undefined && ldl + hdl > total + 0.5) return true;
  return false;
}

/** Arithmetic on typed values only (architect §16.1): non-HDL and atherogenic index, same panel. */
export function calculate(v: { total?: number; hdl?: number }): { non_hdl?: number; athero_index?: number } {
  if (v.total === undefined || v.hdl === undefined || v.hdl <= 0) return {};
  const nonHdl = v.total - v.hdl;
  if (nonHdl < 0) return {};
  return { non_hdl: nonHdl, athero_index: nonHdl / v.hdl };
}
