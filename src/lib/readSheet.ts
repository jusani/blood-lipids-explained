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

/** Every name the guide lists, longest first, so "MTL cholesterolis" wins over "Cholesterolis". */
function nameTable(): { name: string; id: MarkerId }[] {
  const rows: { name: string; id: MarkerId }[] = [];
  for (const m of markers) {
    for (const n of new Set([m.lab_names.lt, m.lab_names.en, m.names.lt, m.names.en, ...m.aliases])) {
      rows.push({ name: fold(n).replace(/\s+/g, ' ').trim(), id: m.id });
    }
  }
  return rows.sort((a, b) => b.name.length - a.name.length);
}

const NUMBER = /(\d+(?:[.,]\d+)?)/;

function unitOf(rest: string): Unit | null {
  const r = rest.replace(/\s+/g, '');
  if (/mg\/?d[l1i|]/.test(r)) return 'mg/dL';
  if (/mmol/.test(r)) return 'mmol/L';
  return null;
}

/** One line of text → which value it names and the number after the name, if any. */
export function readLine(line: string, table = nameTable()): { id: MarkerId; value: SheetValue } | null {
  const folded = fold(line).replace(/[|:]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[^a-z]+/, '');
  const m = NUMBER.exec(folded);
  if (!m || m.index === undefined) return null;
  const name = folded.slice(0, m.index).trim();
  const hit = table.find((r) => name === r.name || (name.startsWith(r.name) && !/[a-z]/.test(name[r.name.length] ?? '')));
  if (!hit) return null;
  const text = m[1];
  const p = parseInput(text);
  if (p.kind !== 'number') return null;
  const unit = unitOf(folded.slice(m.index + text.length));
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
