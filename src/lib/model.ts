// On-device data model (architect.md §5). Statuses, flags and anything else
// the rules engine will derive are never stored.

import type { Lang, MarkerId, Mode, Unit } from '../content/types';

export type YesNoUnsure = 'yes' | 'no' | 'not_sure' | null;
export type YesNoDontKnow = 'yes' | 'no' | 'dont_know' | null;

export interface StoredValue {
  entered: number;
  unit: Unit;
  canonicalMmol: number;
  unitConfirmedBy: 'default' | 'person_answered_prompt';
  decimalFixedFrom?: number;
}

export interface Safety {
  cholMedicine: YesNoUnsure;
  familyEarlyCHD: YesNoDontKnow;     // includes relatives told they have FH (QA S4)
  knownCvdDiabetesCkd: YesNoUnsure;  // QA B4
  pregnant: 'yes' | 'no' | null;     // QA S5
}

export interface Panel {
  id: string;
  testDate: string | null;           // YYYY-MM-DD, null = "I don't know"
  enteredAt: string;                 // ISO timestamp
  defaultUnit: Unit;
  values: Partial<Record<MarkerId, StoredValue>>;
  safety: Safety;
  mode: Mode;
  helperName?: string;
  contentVersionSeen: string;
  source: 'manual' | 'restored';
}

export interface Settings {
  language: Lang | null;             // null until chosen or detected
  textSize: 1 | 2 | 3;
  mode: Mode;
  storageConsent: 'keep' | 'none' | null;
  consentAt?: string;
}

export const defaultSettings: Settings = {
  language: null,
  textSize: 1,
  mode: 'self',
  storageConsent: null,
};

export const emptySafety: Safety = {
  cholMedicine: null,
  familyEarlyCHD: null,
  knownCvdDiabetesCkd: null,
  pregnant: null,
};

export function newId(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A habit the person wrote as an if-then plan (designer S12). Max three. */
export interface Habit {
  id: string;
  cue: string;
  action: string;
  createdAt: string;                 // YYYY-MM-DD
  leverId: string | null;            // the habit option it came from, when options exist
}

/** One answer on the Today screen. No answer = no row (architect §5). */
export interface CheckIn {
  habitId: string;
  date: string;                      // YYYY-MM-DD
  result: 'done' | 'not_today';
}

export interface Plan {
  habits: Habit[];
  checkins: CheckIn[];
  retestDate: string | null;         // YYYY-MM-DD, chosen by the person
  /** Habit questionnaire answers; they only suggest if-then cues (QA M2). */
  answers?: Partial<Record<string, string>>;
}

export const emptyPlan: Plan = { habits: [], checkins: [], retestDate: null };
export const MAX_HABITS = 3;

/** Local calendar date as YYYY-MM-DD. */
export function isoDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + n));
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(y, m - 1 + n + 1, 0).getDate(); // 31 Jan + 1 month = 28/29 Feb
  return isoDay(new Date(y, m - 1 + n, Math.min(d, last)));
}
