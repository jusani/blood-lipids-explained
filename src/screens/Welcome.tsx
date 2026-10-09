import { Statement } from '../components/Statement';
import { useApp } from '../app';
import { pack } from '../content';
import { formatDate } from '../lib/i18n';

export function Welcome() {
  const { t, lang, go, saved, setCurrent, flash, setFlash, resetDraft, plan } = useApp();
  return (
    <>
      {flash && (
        <p class="notice" role="status">
          {t(flash)}{' '}
          <button class="linkbtn" onClick={() => setFlash(null)}>{t('guide_close')}</button>
        </p>
      )}
      <h1 tabIndex={-1}>{t('welcome_title')}</h1>
      <p class="sub">{t('welcome_sub')}</p>
      {plan.habits.length > 0 && <button class="btn" onClick={() => go('today')}>{t('today_btn')}</button>}
      <button class={plan.habits.length ? 'btn ghost' : 'btn'} onClick={() => { resetDraft(); setFlash(null); go('whose'); }}>{t('explain_btn')}</button>
      <ul class="promises">
        <li>{t('promise_free')}</li>
        <li>{t('promise_data')}</li>
        <li>{t('promise_edu')}</li>
      </ul>
      <Statement />
      <p class="small">
        {t('adults_only')} · {t('official_address', { address: pack.official_address })}
      </p>
      {saved.length > 0 && (
        <section class="stack" aria-labelledby="saved-h">
          <h2 id="saved-h">{t('saved_results_title')}</h2>
          <div class="rows">
            {saved.map((p) => (
              <div class="row" key={p.id}>
                <button class="rowlink" onClick={() => { setCurrent(p); go('results'); }}>
                  <span>{p.testDate ? t('saved_result_row', { date: formatDate(p.testDate, lang) }) : t('date_not_known')}</span>
                  <span class="chev" aria-hidden="true">›</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
