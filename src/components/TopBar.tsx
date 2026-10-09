import { useApp } from '../app';

export function TopBar({ canGoBack }: { canGoBack: boolean }) {
  const { t, lang, settings, updateSettings, back, go, screen } = useApp();
  const size = settings.textSize;
  const nextSize = ((size % 3) + 1) as 1 | 2 | 3;
  return (
    <header class="top">
      {canGoBack ? (
        <button class="tbtn back" onClick={back}>‹ {t('back')}</button>
      ) : (
        <span class="title">{t('app_name')}</span>
      )}
      {canGoBack && <span class="spacer" />}
      <button
        class="tbtn"
        onClick={() => updateSettings({ textSize: nextSize })}
        aria-label={`${t('text_size')}: ${t(`text_size_${size}`)}`}
        title={t('text_size')}
      >
        <span aria-hidden="true" style={{ fontSize: size === 1 ? '13px' : size === 2 ? '16px' : '19px' }}>Aa</span>
      </button>
      <button
        class="tbtn"
        onClick={() => updateSettings({ language: lang === 'lt' ? 'en' : 'lt' })}
        aria-label={t('switch_language')}
      >
        <span lang="lt" class={lang === 'lt' ? '' : 'dim'}>{lang === 'lt' ? <b>LT</b> : 'LT'}</span>
        <span aria-hidden="true" class="dim">&nbsp;·&nbsp;</span>
        <span lang="en" class={lang === 'en' ? '' : 'dim'}>{lang === 'en' ? <b>EN</b> : 'EN'}</span>
      </button>
      {screen !== 'more' && (
        <button class="tbtn" onClick={() => go('more')}>{t('more')}</button>
      )}
    </header>
  );
}
