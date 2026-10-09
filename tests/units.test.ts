import { describe, expect, it } from 'vitest';
import { markerById } from '../src/content';
import { assessField, calculate, decimalSuggestion, looksSwapped, parseInput, toMmol } from '../src/lib/units';

const ldl = markerById.ldl, tg = markerById.tg, hdl = markerById.hdl;

describe('parseInput', () => {
  it('accepts comma and dot', () => {
    expect(parseInput('4,1')).toEqual({ kind: 'number', value: 4.1, decimals: 1, usedComma: true });
    expect(parseInput(' 4.1 ')).toEqual({ kind: 'number', value: 4.1, decimals: 1, usedComma: false });
    expect(parseInput('5')).toMatchObject({ kind: 'number', value: 5, decimals: 0 });
  });
  it('rejects thousands separators, signs and words', () => {
    for (const s of ['1 234', '1.234,5', '1,234.5', '-4', '4,1,2', 'abc', '4.1 mmol', '.5']) expect(parseInput(s).kind).toBe('invalid');
  });
  it('treats blank as empty', () => expect(parseInput('  ').kind).toBe('empty'));
  it('counts decimals for QA E3', () => expect(parseInput('1,234')).toMatchObject({ value: 1.234, decimals: 3 }));
});

describe('conversion (architect §5.1)', () => {
  it('uses 38.67 for cholesterol and 88.6 for TG (evidence pack)', () => {
    expect(toMmol(190, 'mg/dL', ldl)).toBeCloseTo(4.913, 3);
    expect(toMmol(189, 'mg/dL', ldl)).toBeCloseTo(4.888, 3);
    expect(toMmol(194, 'mg/dL', tg)).toBeCloseTo(2.19, 2);
    expect(toMmol(4.1, 'mmol/L', ldl)).toBe(4.1);
  });
});

describe('unit prompt (QA B5, designer §13.2)', () => {
  it('leaves ordinary mmol/L values alone', () => {
    expect(assessField(4.1, 1, 'mmol/L', ldl)).toBeNull();
    expect(assessField(2.2, 1, 'mmol/L', tg)).toBeNull();
  });
  it('TG 194 in mmol/L: decimal first, then mg/dL, then retype; nothing as typed', () => {
    const a = assessField(194, 0, 'mmol/L', tg)!;
    expect(a.reason).toBe('implausible');
    expect(a.options).toEqual([
      { kind: 'decimal', value: 1.94, unit: 'mmol/L' },
      { kind: 'other_unit', value: 194, unit: 'mg/dL' },
      { kind: 'retype' },
    ]);
  });
  it('LDL 130 in mmol/L suggests 1.3 then 130 mg/dL', () => {
    const a = assessField(130, 0, 'mmol/L', ldl)!;
    expect(a.options.map((o) => o.kind)).toEqual(['decimal', 'other_unit', 'retype']);
  });
  it('TG 25 always asks and offers keeping 25 mmol/L (never silently mg/dL)', () => {
    const a = assessField(25, 0, 'mmol/L', tg)!;
    expect(a.reason).toBe('ambiguous');
    expect(a.options).toContainEqual({ kind: 'as_typed', value: 25, unit: 'mmol/L' });
    expect(a.options).toContainEqual({ kind: 'other_unit', value: 25, unit: 'mg/dL' });
  });
  it('TG 10 to 100 asks in mg/dL panels too', () => {
    expect(assessField(50, 0, 'mg/dL', tg)?.reason).toBe('ambiguous');
    expect(assessField(9.9, 1, 'mmol/L', tg)).toBeNull();
    expect(assessField(150, 0, 'mg/dL', tg)).toBeNull();
  });
  it('a small number in an mg/dL panel suggests mmol/L', () => {
    const a = assessField(4.1, 1, 'mg/dL', ldl)!;
    expect(a.options).toContainEqual({ kind: 'other_unit', value: 4.1, unit: 'mmol/L' });
  });
  it('more than two decimals asks (QA E3)', () => {
    expect(assessField(1.234, 3, 'mmol/L', hdl)?.reason).toBe('decimals');
  });
  it('decimal suggestion lands in the typical range only', () => {
    expect(decimalSuggestion(41, 'mmol/L', ldl)).toBe(4.1);
    expect(decimalSuggestion(5, 'mmol/L', ldl)).toBeNull();
  });
});

describe('cross-field check (QA E1)', () => {
  it('flags values that do not fit together', () => {
    expect(looksSwapped({ ldl: 4.1, total: 1.3, hdl: 6.3 - 5 })).toBe(true);
    expect(looksSwapped({ ldl: 4.6, total: 6.3, hdl: 2.4 })).toBe(true);
    expect(looksSwapped({ ldl: 4.1, total: 6.3, hdl: 1.3 })).toBe(false);
    expect(looksSwapped({ ldl: 7, total: 6.3 })).toBe(true);
    expect(looksSwapped({ ldl: 4.1 })).toBe(false);
  });
});

describe('calculated values', () => {
  it('non-HDL and atherogenic index from the same panel only', () => {
    const c = calculate({ total: 6.3, hdl: 1.3 });
    expect(c.non_hdl).toBeCloseTo(5.0);
    expect(c.athero_index).toBeCloseTo(3.846, 2);
    expect(calculate({ total: 6.3 })).toEqual({});
  });
});
