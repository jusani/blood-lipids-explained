import { useRef, useState } from 'preact/hooks';
import { Statement } from '../components/Statement';
import { useApp } from '../app';
import { buildPanel, checkDraft } from '../lib/entry';
import { formatDate } from '../lib/i18n';
import { AnswerRows, ValueRows } from '../components/Values';

export function Confirm() {
  const { t, lang, mode, draft, setDraft, go, backTo, setCurrent, settings, keepPanel, isSaved } = useApp();
  const preview = buildPanel(draft, mode);
  // QA R1: values read from a photo or PDF are marked, and one tick confirms they were checked
  // against the sheet (a misread can lower a value without any question being asked).
  const read = (draft.readFromSheet ?? []).filter((id) => preview.values[id]);
  const tick = useRef<HTMLInputElement>(null);
  const [needTick, setNeedTick] = useState(false);
  if (!checkDraft(draft).ready) {
    return (
      <>
        <h1 tabIndex={-1}>{t('confirm_title')}</h1>
        <button class="btn" onClick={() => backTo('entry')}>{t('edit')}</button>
      </>
    );
  }
  const show = async () => {
    setDraft((d) => ({ ...d, panelId: preview.id }));
    setCurrent(preview);
    // Already chose to keep results (or kept this one earlier): save straight away.
    if ((mode === 'self' && settings.storageConsent === 'keep') || isSaved(preview.id)) {
      await keepPanel(preview);
      go('results');
      return;
    }
    // Consent is asked before the first save, not before typing (designer S0, G1).
    // Helpers skip it: nothing is saved unless they choose to keep (designer §6).
    if (mode === 'self' && settings.storageConsent === null) go('consent');
    else go('results');
  };
  return (
    <>
      <h1 tabIndex={-1}>{t('confirm_title')}</h1>
      <p>{preview.testDate ? t('confirm_date', { date: formatDate(preview.testDate, lang) }) : t('date_not_known')}</p>
      <ValueRows values={preview.values} onEdit={() => backTo('entry')} marked={read} />
      {read.length > 0 && (
        <>
          <label class="check">
            <input ref={tick} type="checkbox" checked={!!draft.sheetChecked} aria-describedby="tick-why"
              onChange={(e) => { setNeedTick(false); setDraft((d) => ({ ...d, sheetChecked: (e.target as HTMLInputElement).checked })); }} />
            {t('read_sheet_checked')}
          </label>
          <p id="tick-why" class="err-text" aria-live="polite">{needTick ? t('read_sheet_tick_first') : ''}</p>
        </>
      )}
      <h2>{t('answers_heading')}</h2>
      <AnswerRows safety={preview.safety} />
      <button class="linkbtn" onClick={() => backTo('safety')}>{t('edit')}: {t('answers_heading').toLowerCase()}</button>
      <Statement />
      <button class="btn" onClick={() => {
        // The button stays enabled so it can say why it waits (screen readers often skip disabled ones).
        if (read.length > 0 && !draft.sheetChecked) { setNeedTick(true); tick.current?.focus(); return; }
        void show();
      }}>{t('show_explanation')}</button>
    </>
  );
}
