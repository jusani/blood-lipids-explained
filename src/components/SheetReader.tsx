import { useRef, useState } from 'preact/hooks';
import { useApp } from '../app';
import { markers } from '../content';
import type { MarkerId } from '../content/types';
import { setDefaultUnit, setFieldText } from '../lib/entry';
import type { SheetValues } from '../lib/readSheet';
import { isChunkLoadError, nothingToLose, reloadForUpdate } from '../lib/updateRecovery';

// v2 prototype (photoReading flag): fills the empty entry fields from a photo or PDF of the lab
// sheet. Values only land in the form; the person checks each one there and on the confirm screen.
export function SheetReader() {
  const { t, draft, setDraft, current, isSaved, settings, plan } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'busy'; p: number } | { kind: 'done'; n: number } | { kind: 'failed' }>({ kind: 'idle' });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setState({ kind: 'busy', p: 0 });
    let found: SheetValues;
    try {
      const { readSheetFile } = await import('../lib/sheetReader');
      found = await readSheetFile(file, (p) => setState({ kind: 'busy', p }));
    } catch (e) {
      if (isChunkLoadError(e) && nothingToLose(draft, current, isSaved, settings, plan) && reloadForUpdate()) return;
      setDraft((d) => ({ ...d, sheetUsed: true, sheetFeedbackDone: false }));
      setState({ kind: 'failed' });
      return;
    }
    const filled: MarkerId[] = [];
    const stated = markers.map((m) => found[m.id]?.unit).find(Boolean);
    let next = stated && !markers.some((m) => draft.fields[m.id].text.trim()) ? setDefaultUnit(draft, stated) : draft;
    for (const m of markers) {
      const v = found[m.id];
      if (!v || next.fields[m.id].text.trim()) continue; // never overwrite what the person typed
      next = setFieldText(next, m.id, v.text);
      if (v.unit && v.unit !== next.defaultUnit) next = { ...next, fields: { ...next.fields, [m.id]: { ...next.fields[m.id], unit: v.unit } } };
      filled.push(m.id);
    }
    setDraft({ ...next, readFromSheet: [...(next.readFromSheet ?? []), ...filled], sheetChecked: false, sheetUsed: true, sheetFeedbackDone: false });
    setState({ kind: 'done', n: filled.length });
    if (input.current) input.current.value = '';
  };

  return (
    <div class="card readsheet">
      <input ref={input} type="file" accept="image/*,application/pdf" hidden aria-hidden="true"
        onChange={(e) => void pick((e.target as HTMLInputElement).files?.[0])} />
      <button class="btn ghost" disabled={state.kind === 'busy'} onClick={() => input.current?.click()}>{t('read_sheet_btn')}</button>
      <p class="testing">{t('read_sheet_testing')}</p>
      <p class="small">{t('read_sheet_note')}</p>
      <p class="small" aria-live="polite">
        {state.kind === 'busy' && t('read_sheet_busy', { pct: Math.round(state.p * 100) })}
        {state.kind === 'done' && (state.n > 0 ? t('read_sheet_found', { n: state.n, total: markers.length }) : t('read_sheet_none'))}
        {state.kind === 'failed' && t('read_sheet_failed')}
      </p>
    </div>
  );
}
