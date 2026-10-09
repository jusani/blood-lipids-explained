import { useState } from 'preact/hooks';
import { useApp } from '../app';
import type { Lang } from '../content/types';
import { translate } from '../lib/i18n';

/** The link carries no values, statuses or sender information; only ?lang (architect §16.4). */
export function shareUrl(lang: Lang): string {
  return `${location.origin}${location.pathname}?lang=${lang}`;
}

export function Share() {
  const { t, lang } = useApp();
  const [msgLang, setMsgLang] = useState<Lang>(lang);
  const [status, setStatus] = useState<string | null>(null);
  const text = translate(msgLang, 'self', 'share_text');
  const url = shareUrl(msgLang);
  const canShare = typeof navigator.share === 'function';

  const share = async () => {
    try {
      await navigator.share({ text, url });
    } catch { /* cancelled */ }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setStatus(t('copied'));
    } catch {
      setStatus(t('copy_failed'));
    }
  };

  return (
    <>
      <h1 tabIndex={-1}>{t('share_title')}</h1>
      <div class="stack">
        <span class="small" id="msg-lang">{t('share_lang')}</span>
        <div class="seg" role="group" aria-labelledby="msg-lang">
          {(['lt', 'en'] as Lang[]).map((l) => (
            <button key={l} lang={l} aria-pressed={msgLang === l} onClick={() => setMsgLang(l)}>
              {l === 'lt' ? 'Lietuvių' : 'English'}
            </button>
          ))}
        </div>
      </div>
      <p class="small">{t('share_preview_label')}</p>
      <div class="sharebox" lang={msgLang}>
        <p>{text}</p>
        <p class="small">{url}</p>
      </div>
      <p><b>{t('share_never')}</b></p>
      {canShare && <button class="btn" onClick={share}>{t('share_btn')}</button>}
      <button class={canShare ? 'btn ghost' : 'btn'} onClick={copy}>{t('copy_link')}</button>
      {status && <p class="small" role="status">{status}</p>}
    </>
  );
}
