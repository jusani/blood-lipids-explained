import { useApp } from '../app';

/** "This app is not a medical advisor…" (Justina, 2026-10-08; QA §18). Shown before and with results. */
export function Statement() {
  const { t, go } = useApp();
  return (
    <p class="statement" role="note">
      {t('not_medical_advisor')}{' '}
      <button class="linkbtn inline" onClick={() => go('sources')}>{t('sources')}</button>
    </p>
  );
}
