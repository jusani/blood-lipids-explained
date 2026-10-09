import { useApp } from '../app';
import { pack, packSigned } from '../content';
import { TrustLine } from '../components/TrustLine';

export function About() {
  const { t } = useApp();
  return (
    <>
      <h1 tabIndex={-1}>{t('about_title')}</h1>
      <p>{t('intended_purpose')}</p>
      <p>{t('about_made_by')}</p>
      <p>{t('about_checked')}</p>
      <h2>{t('about_privacy_title')}</h2>
      <p>{t('about_privacy')}</p>
      {pack.feedback_email && (
        // A plain email link: nothing is sent unless the person sends the email (no server, QA L1/L2).
        <section class="stack" aria-labelledby="fb-h">
          <h2 id="fb-h">{t('feedback_title')}</h2>
          <p>{t('feedback_body')}</p>
          <a class="btn ghost" href={feedbackHref(pack.feedback_email, t('feedback_subject'), t('feedback_template'))}>{t('feedback_btn')}</a>
        </section>
      )}
      <h2>{t('about_disclaimer_title')}</h2>
      <p>{t('about_disclaimer')}</p>
      <p class="small">{t('adults_only')} · {t('official_address', { address: pack.official_address })}</p>
      <p class="small">
        {t('content_version', { version: pack.manifest.version })}
        {!packSigned && ` (${t('content_unchecked')})`}
      </p>
      <TrustLine />
    </>
  );
}

/** mailto link with a subject and the two pilot questions as an empty template. No values. */
export function feedbackHref(address: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(address).replace('%40', '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
