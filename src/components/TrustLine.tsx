import { useApp } from '../app';

/** "Not a diagnosis, not reviewed by a doctor, sources linked": small and calm (designer §12.2). */
export function TrustLine() {
  const { t, go } = useApp();
  return (
    <p class="trust">
      {t('trust_line')}{' '}
      <button class="linkbtn" style={{ padding: 0, minHeight: 0 }} onClick={() => go('sources')}>{t('sources')}</button>
    </p>
  );
}
