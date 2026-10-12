// Photo and PDF reading (v2 prototype, behind the photoReading flag): turns the text read from a
// lab sheet into entry-field text. Pure functions only, so they are easy to test.
//
// Cautious by design (phase-v2/v2-scope.md §3): a value is only filled when its line starts with a
// name the lab sheet guide lists and the number is plausible; anything unsure stays empty for the
// person to type. Every filled value still goes through the entry checks and the confirm screen.

import { markers } from '../content';
import type { MarkerId, Unit } from '../content/types';
import { isPlausible, parseInput } from './units';

export interface SheetValue {
  /** The number as printed, e.g. "4,1": it goes into the entry field unchanged. */
  text: string;
  /** Only when the line itself names a unit. */
  unit: Unit | null;
}

export type SheetValues = Partial<Record<MarkerId, SheetValue>>;

/** Lower case, accents removed, so "Mažo" and "mazo" match (OCR often drops them). */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Short forms LT labs print that the names list does not show yet: "TGL" (Antėja's test list) and
 * "TRIG" (common analyser code). Reading only; nothing on screen changes.
 */
const EXTRA_NAMES: Partial<Record<MarkerId, string[]>> = { tg: ['TGL', 'TRIG'] };

/** Every name the guide lists, longest first, so "MTL cholesterolis" wins over "Cholesterolis". */
function nameTable(): { name: string; id: MarkerId }[] {
  const rows: { name: string; id: MarkerId }[] = [];
  for (const m of markers) {
    for (const n of new Set([m.lab_names.lt, m.lab_names.en, m.names.lt, m.names.en, ...m.aliases, ...(EXTRA_NAMES[m.id] ?? [])])) {
      rows.push({ name: fold(n).replace(/\s+/g, ' ').trim(), id: m.id });
    }
  }
  return rows.sort((a, b) => b.name.length - a.name.length);
}

const NUMBER = /\d+(?:[.,]\d+)?/g;
/** Ratios, indexes and non-HDL lines name a value but are not it (QA PR1). */
const NOT_A_VALUE = /santyk|ratio|index|indeks|non[- ]?hdl|ne[- ]?dtl|\bnedtl/;

function unitOf(rest: string): Unit | null {
  const r = rest.replace(/\s+/g, '');
  if (/mg\/?d[l1i|]/.test(r)) return 'mg/dL';
  if (/mmol/.test(r)) return 'mmol/L';
  return null;
}

/**
 * The numbers after the name that could be the result: not a limit ("< 5,2", "> 1,0"), not either
 * end of a range ("3,9 - 6,1"). QA PR2.
 */
function candidates(rest: string): { text: string; end: number }[] {
  const all = [...rest.matchAll(NUMBER)].map((m) => ({ text: m[0], start: m.index!, end: m.index! + m[0].length }));
  const inRange = new Set<number>();
  for (let i = 0; i + 1 < all.length; i++) {
    if (/^\s*(?:-|–|—|\.\.\.?|…)\s*$/.test(rest.slice(all[i].end, all[i + 1].start))) { inRange.add(i); inRange.add(i + 1); }
  }
  return all.filter((n, i) => !inRange.has(i) && !/[<>≤≥]\s*=?\s*$/.test(rest.slice(0, n.start)));
}

/** One line of text → which value it names and the number after the name, if any. */
export function readLine(line: string, table = nameTable()): { id: MarkerId; value: SheetValue } | null {
  const folded = fold(line).replace(/[|:]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[^a-z]+/, '');
  if (NOT_A_VALUE.test(folded)) return null;
  const hit = table.find((r) => folded.startsWith(r.name) && !/[a-z]/.test(folded[r.name.length] ?? ''));
  if (!hit) return null;
  const rest = folded.slice(hit.name.length);
  if (/^\s*\//.test(rest)) return null;                       // "Cholesterolis/DTL ..." is a ratio
  const numbers = candidates(rest);
  // A previous result or a second figure on the line: unsure, so the person types it (QA PR2).
  if (numbers.length !== 1) return null;
  const text = numbers[0].text;
  const p = parseInput(text);
  if (p.kind !== 'number') return null;
  const unit = unitOf(rest.slice(numbers[0].end));
  const marker = markers.find((x) => x.id === hit.id)!;
  const fits = unit ? isPlausible(p.value, unit, marker) : isPlausible(p.value, 'mmol/L', marker) || isPlausible(p.value, 'mg/dL', marker);
  return fits ? { id: hit.id, value: { text, unit } } : null;
}

/** All lines of a sheet → the first plausible reading of each value. */
export function parseLabText(text: string): SheetValues {
  const table = nameTable();
  const out: SheetValues = {};
  for (const line of text.split(/\r?\n/)) {
    const r = readLine(line, table);
    if (r && !out[r.id]) out[r.id] = r.value;
  }
  return out;
}

/** PDF text items (x, y, text) → lines, top to bottom, left to right. */
export function itemsToLines(items: { x: number; y: number; text: string }[], tolerance = 3): string[] {
  const sorted = items.filter((i) => i.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; parts: { x: number; text: string }[] }[] = [];
  for (const i of sorted) {
    const line = lines.find((l) => Math.abs(l.y - i.y) <= tolerance);
    if (line) line.parts.push({ x: i.x, text: i.text });
    else lines.push({ y: i.y, parts: [{ x: i.x, text: i.text }] });
  }
  return lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.text.trim()).join(' '));
}
