// Backup and restore by file (architect.md §5.3 step 5, §5.5; QA P4, L4).
// The file is plain JSON the person controls. Restore never trusts the file:
// every value is re-validated and its canonical mmol/L recomputed.

import { markerById, pack } from '../content';
import type { MarkerId, Unit } from '../content/types';
import { emptyPlan, emptySafety, MAX_HABITS, type CheckIn, type Habit, type Panel, type Plan, type Settings, type StoredValue } from './model';
import { isPlausible, toMmol } from './units';
import { cleanAnswers } from './questionnaire';

export const BACKUP_FORMAT = 'blood-lipids-explained-backup';
export const BACKUP_SCHEMA = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  contentVersion: string;
  settings: Pick<Settings, 'language' | 'textSize' | 'mode'>;
  panels: Panel[];
  plan?: Plan;
}

export function makeBackup(settings: Settings, panels: Panel[], now = new Date(), plan?: Plan): BackupFile {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA,
    exportedAt: now.toISOString(),
    contentVersion: pack.manifest.version,
    settings: { language: settings.language, textSize: settings.textSize, mode: settings.mode },
    panels,
    ...(plan && (plan.habits.length || plan.retestDate || plan.answers) ? { plan } : {}),
  };
}

/** Neutral name: says nothing about cholesterol to anyone glancing at a downloads folder (QA P4). */
export function backupFileName(now = new Date()): string {
  return `backup-${now.toISOString().slice(0, 10)}.json`;
}

export type RestoreResult =
  | { ok: true; panels: Panel[]; settings: Partial<Settings>; plan: Plan | null }
  | { ok: false; error: 'invalid' | 'newer' };

const UNITS: Unit[] = ['mmol/L', 'mg/dL'];
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const oneOf = <T,>(x: unknown, allowed: readonly T[]): T | null => (allowed.includes(x as T) ? (x as T) : null);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readValue(id: MarkerId, raw: unknown): StoredValue | null {
  if (!isObj(raw)) return null;
  const marker = markerById[id];
  const entered = raw.entered;
  const unit = oneOf(raw.unit, UNITS);
  if (typeof entered !== 'number' || !Number.isFinite(entered) || !unit) return null;
  if (!isPlausible(entered, unit, marker)) return null;
  const v: StoredValue = {
    entered,
    unit,
    canonicalMmol: toMmol(entered, unit, marker),
    unitConfirmedBy: raw.unitConfirmedBy === 'person_answered_prompt' ? 'person_answered_prompt' : 'default',
  };
  if (typeof raw.decimalFixedFrom === 'number' && Number.isFinite(raw.decimalFixedFrom)) v.decimalFixedFrom = raw.decimalFixedFrom;
  return v;
}

function readPanel(raw: unknown): Panel | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(raw.id)) return null;
  if (!isObj(raw.values)) return null;
  const values: Panel['values'] = {};
  for (const id of Object.keys(markerById) as MarkerId[]) {
    if (raw.values[id] === undefined) continue;
    const v = readValue(id, raw.values[id]);
    if (!v) return null; // a damaged value means we can't vouch for the panel
    values[id] = v;
  }
  if (Object.keys(values).length === 0) return null;
  const s = isObj(raw.safety) ? raw.safety : {};
  const testDate = typeof raw.testDate === 'string' && DATE_RE.test(raw.testDate) ? raw.testDate : null;
  const enteredAt = typeof raw.enteredAt === 'string' && !Number.isNaN(Date.parse(raw.enteredAt)) ? raw.enteredAt : new Date().toISOString();
  const panel: Panel = {
    id: raw.id,
    testDate,
    enteredAt,
    defaultUnit: oneOf(raw.defaultUnit, UNITS) ?? 'mmol/L',
    values,
    safety: {
      ...emptySafety,
      cholMedicine: oneOf(s.cholMedicine, ['yes', 'no', 'not_sure'] as const),
      familyEarlyCHD: oneOf(s.familyEarlyCHD, ['yes', 'no', 'dont_know'] as const),
      knownCvdDiabetesCkd: oneOf(s.knownCvdDiabetesCkd, ['yes', 'no', 'not_sure'] as const),
      pregnant: oneOf(s.pregnant, ['yes', 'no'] as const),
    },
    mode: raw.mode === 'helper' ? 'helper' : 'self',
    contentVersionSeen: typeof raw.contentVersionSeen === 'string' ? raw.contentVersionSeen.slice(0, 40) : pack.manifest.version,
    source: 'restored',
  };
  if (typeof raw.helperName === 'string' && raw.helperName.trim()) panel.helperName = raw.helperName.trim().slice(0, 60);
  return panel;
}

export function parseBackup(text: string): RestoreResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (!isObj(data) || data.format !== BACKUP_FORMAT || typeof data.schemaVersion !== 'number') return { ok: false, error: 'invalid' };
  if (data.schemaVersion > BACKUP_SCHEMA) return { ok: false, error: 'newer' };
  // Older schema versions get migrated here when there are any.
  if (!Array.isArray(data.panels)) return { ok: false, error: 'invalid' };
  const panels = data.panels.map(readPanel).filter((p): p is Panel => p !== null);
  if (panels.length === 0) return { ok: false, error: 'invalid' };
  const settings: Partial<Settings> = {};
  if (isObj(data.settings)) {
    const lang = oneOf(data.settings.language, ['lt', 'en'] as const);
    if (lang) settings.language = lang;
    const size = oneOf(data.settings.textSize, [1, 2, 3] as const);
    if (size) settings.textSize = size;
  }
  return { ok: true, panels, settings, plan: readPlan(data.plan) };
}

const text = (x: unknown, max: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null);

function readPlan(raw: unknown): Plan | null {
  if (!isObj(raw)) return null;
  const habits: Habit[] = (Array.isArray(raw.habits) ? raw.habits : []).flatMap((h): Habit[] => {
    if (!isObj(h) || typeof h.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(h.id)) return [];
    const cue = text(h.cue, 120), action = text(h.action, 160);
    if (!cue || !action) return [];
    const createdAt = typeof h.createdAt === 'string' && DATE_RE.test(h.createdAt) ? h.createdAt : new Date().toISOString().slice(0, 10);
    return [{ id: h.id, cue, action, createdAt, leverId: text(h.leverId, 64) }];
  }).slice(0, MAX_HABITS);
  const ids = new Set(habits.map((h) => h.id));
  const checkins: CheckIn[] = (Array.isArray(raw.checkins) ? raw.checkins : []).flatMap((c): CheckIn[] => {
    if (!isObj(c) || typeof c.habitId !== 'string' || !ids.has(c.habitId)) return [];
    if (typeof c.date !== 'string' || !DATE_RE.test(c.date)) return [];
    const result = oneOf(c.result, ['done', 'not_today'] as const);
    return result ? [{ habitId: c.habitId, date: c.date, result }] : [];
  });
  const retestDate = typeof raw.retestDate === 'string' && DATE_RE.test(raw.retestDate) ? raw.retestDate : null;
  const answers = cleanAnswers(raw.answers);
  if (!habits.length && !retestDate && !answers) return null;
  return { ...emptyPlan, habits, checkins, retestDate, ...(answers ? { answers } : {}) };
}
