import { useApp } from '../app';

export function Consent() {
  const { t, current, keepPanel, updateSettings, go } = useApp();
  const keep = async () => {
    if (current) await keepPanel(current);
    else await updateSettings({ storageConsent: 'keep', consentAt: new Date().toISOString() });
    go('results');
  };
  const none = async () => {
    await updateSettings({ storageConsent: 'none', consentAt: new Date().toISOString() });
    go('results');
  };
  return (
    <>
      <h1 tabIndex={-1}>{t('consent_title')}</h1>
      <p>{t('consent_body')}</p>
      {/* Equal weight for both choices (designer S0). */}
      <button class="btn ghost" onClick={keep}>{t('consent_keep')}</button>
      <button class="btn ghost" onClick={none}>{t('consent_none')}</button>
      <p class="small">{t('consent_note')}</p>
    </>
  );
}
