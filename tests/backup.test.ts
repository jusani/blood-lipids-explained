import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from '../src/lib/backup';
import { defaultSettings, emptySafety, type Panel } from '../src/lib/model';
import { deleteEverything, listPanels, loadSettings, savePanel, saveSettings } from '../src/lib/store';

const panel: Panel = {
  id: 'abc123',
  testDate: '2026-09-18',
  enteredAt: '2026-10-07T10:00:00.000Z',
  defaultUnit: 'mmol/L',
  values: {
    ldl: { entered: 4.1, unit: 'mmol/L', canonicalMmol: 4.1, unitConfirmedBy: 'default' },
    tg: { entered: 194, unit: 'mg/dL', canonicalMmol: 2.19, unitConfirmedBy: 'person_answered_prompt' },
  },
  safety: { ...emptySafety, cholMedicine: 'no', familyEarlyCHD: 'dont_know' },
  mode: 'self',
  contentVersionSeen: '2026.1-draft.3',
  source: 'manual',
};

describe('backup file', () => {
  it('round-trips a panel', () => {
    const text = JSON.stringify(makeBackup({ ...defaultSettings, language: 'lt' }, [panel]));
    const r = parseBackup(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.panels[0].values.ldl?.canonicalMmol).toBe(4.1);
    expect(r.panels[0].values.tg?.canonicalMmol).toBeCloseTo(194 / 88.6, 6);
    expect(r.panels[0].safety.familyEarlyCHD).toBe('dont_know');
    expect(r.panels[0].source).toBe('restored');
    expect(r.settings.language).toBe('lt');
  });
  it('recomputes canonical values instead of trusting the file', () => {
    const bad = makeBackup(defaultSettings, [{ ...panel, values: { ldl: { ...panel.values.ldl!, canonicalMmol: 0.1 } } }]);
    const r = parseBackup(JSON.stringify(bad));
    expect(r.ok && r.panels[0].values.ldl?.canonicalMmol).toBe(4.1);
  });
  it('rejects junk, implausible values and newer schemas', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'invalid' });
    expect(parseBackup('{"format":"x"}')).toEqual({ ok: false, error: 'invalid' });
    const implausible = makeBackup(defaultSettings, [{ ...panel, values: { ldl: { ...panel.values.ldl!, entered: 400 } } }]);
    expect(parseBackup(JSON.stringify(implausible)).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...makeBackup(defaultSettings, [panel]), schemaVersion: 99 }))).toEqual({ ok: false, error: 'newer' });
  });
});

describe('local store', () => {
  it('saves, lists and deletes everything', async () => {
    await saveSettings({ ...defaultSettings, language: 'en', storageConsent: 'keep' });
    await savePanel(panel);
    expect((await listPanels()).map((p) => p.id)).toEqual(['abc123']);
    expect((await loadSettings()).language).toBe('en');
    await deleteEverything();
    expect(await listPanels()).toEqual([]);
    expect((await loadSettings()).storageConsent).toBeNull();
  });
});
