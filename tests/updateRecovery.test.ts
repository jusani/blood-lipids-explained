import { describe, expect, it } from 'vitest';
import { emptyDraft, setFieldText, todayIso } from '../src/lib/entry';
import { defaultSettings, emptyPlan, emptySafety, type Panel, type Plan } from '../src/lib/model';
import { isChunkLoadError, nothingToLose } from '../src/lib/updateRecovery';

const panel = { id: 'p1' } as Panel;
const habitPlan: Plan = { ...emptyPlan, habits: [{ id: 'h', cue: 'a', action: 'b', createdAt: '2026-10-13', leverId: null }] };
const none = { ...defaultSettings, storageConsent: 'none' as const };
const keep = { ...defaultSettings, storageConsent: 'keep' as const };
const saved = (ids: string[]) => (id: string) => ids.includes(id);
const today = todayIso();

describe('reload after a release only when nothing would be lost (U2, QA pass 14 U2-a)', () => {
  it('recognises the browsers\' "could not load a code file" errors only', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: http://x/assets/sheetReader-a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Failed to fetch'))).toBe(false);
  });

  it('a fresh entry with nothing else in memory: safe', () => {
    expect(nothingToLose(emptyDraft(), null, saved([]), none, emptyPlan, today)).toBe(true);
  });

  it('anything typed or changed on the entry screens: not safe', () => {
    const d = emptyDraft();
    expect(nothingToLose(setFieldText(d, 'hdl', '1,1'), null, saved([]), none, emptyPlan, today)).toBe(false);
    expect(nothingToLose({ ...d, helperName: 'Aldona' }, null, saved([]), none, emptyPlan, today)).toBe(false);
    expect(nothingToLose({ ...d, testDate: '2026-09-01' }, null, saved([]), none, emptyPlan, today)).toBe(false);
    expect(nothingToLose({ ...d, dateUnknown: true }, null, saved([]), none, emptyPlan, today)).toBe(false);
    expect(nothingToLose({ ...d, safety: { ...emptySafety, cholMedicine: 'no' } }, null, saved([]), none, emptyPlan, today)).toBe(false);
  });

  it('results held only in memory: not safe; saved results: safe', () => {
    expect(nothingToLose(emptyDraft(), panel, saved([]), none, emptyPlan, today)).toBe(false);
    expect(nothingToLose(emptyDraft(), panel, saved(['p1']), keep, emptyPlan, today)).toBe(true);
  });

  it('a plan not kept on the device: not safe; a kept plan: safe', () => {
    expect(nothingToLose(emptyDraft(), null, saved([]), none, habitPlan, today)).toBe(false);
    expect(nothingToLose(emptyDraft(), null, saved([]), none, { ...emptyPlan, retestDate: '2027-01-13' }, today)).toBe(false);
    expect(nothingToLose(emptyDraft(), null, saved([]), keep, habitPlan, today)).toBe(true);
  });
});
