import { useApp } from '../app';

export function Whose() {
  const { t, mode, updateSettings, go, draft, setDraft } = useApp();
  return (
    <>
      <h1 tabIndex={-1}>{t('whose_title')}</h1>
      <div class="stack">
        <button class="choice" aria-pressed={mode === 'self'} onClick={() => updateSettings({ mode: 'self' })}>
          <b>{t('whose_self')}</b>
          <span class="small">{t('whose_self_sub')}</span>
        </button>
        <button class="choice" aria-pressed={mode === 'helper'} onClick={() => updateSettings({ mode: 'helper' })}>
          <b>{t('whose_helper')}</b>
          <span class="small">{t('whose_helper_sub')}</span>
        </button>
      </div>
      {mode === 'helper' && (
        <div class="field">
          <label for="helper-name">
            <span class="lt">{t('helper_name_label')}</span>
            <span class="en">{t('helper_name_hint')}</span>
          </label>
          <div class="inputrow">
            <input
              id="helper-name"
              autocomplete="off"
              maxLength={60}
              value={draft.helperName}
              onInput={(e) => setDraft({ ...draft, helperName: (e.target as HTMLInputElement).value })}
            />
          </div>
        </div>
      )}
      <button class="btn" onClick={() => go('entry')}>{t('continue')}</button>
    </>
  );
}
