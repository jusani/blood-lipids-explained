import { Statement } from '../components/Statement';
import { useApp } from '../app';
import { buildPanel, checkDraft } from '../lib/entry';
import { formatDate } from '../lib/i18n';
import { AnswerRows, ValueRows } from '../components/Values';

export function Confirm() {
  const { t, lang, mode, draft, setDraft, go, backTo, setCurrent, settings, keepPanel, isSaved } = useApp();
  const preview = buildPanel(draft, mode);
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
      <ValueRows values={preview.values} onEdit={() => backTo('entry')} />
      <h2>{t('answers_heading')}</h2>
      <AnswerRows safety={preview.safety} />
      <button class="linkbtn" onClick={() => backTo('safety')}>{t('edit')}: {t('answers_heading').toLowerCase()}</button>
      <Statement />
      <button class="btn" onClick={show}>{t('show_explanation')}</button>
    </>
  );
}
