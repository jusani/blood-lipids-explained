import { useApp } from '../app';
import { pack, packSigned } from '../content';
import { formatDate } from '../lib/i18n';

export function Sources() {
  const { t, lang } = useApp();
  const groups = pack.source_types.filter((type) => pack.sources.some((s) => s.type === type));
  return (
    <>
      <h1 tabIndex={-1}>{t('sources_title')}</h1>
      <p>{t('sources_intro')}</p>
      {!packSigned && <p class="info">{t('sources_placeholder')}</p>}
      {groups.map((type) => (
        <section class="stack" key={type} aria-labelledby={`group-${type}`}>
          <h2 id={`group-${type}`}>{t(`source_group_${type}`)}</h2>
          {pack.sources.filter((s) => s.type === type).map((s) => {
            const summary = s.summary?.[lang] ?? s.summary?.en;
            return (
              <article class="card" key={s.id}>
                {summary && <p>{summary}</p>}
                <p class="small" lang="en">{s.citation}</p>
                <p class="small">
                  <a href={s.open_link} target="_blank" rel="noopener noreferrer">{t('source_open')}</a>
                  {' · '}{t(s.full_text_free ? 'source_free' : 'source_library')}
                  {s.checked && ` · ${t('source_copy_saved', { date: formatDate(s.checked, lang) })}`}
                </p>
              </article>
            );
          })}
        </section>
      ))}
      <p class="small">
        {t('content_version', { version: pack.manifest.version })}
        {!packSigned && ` (${t('content_unchecked')})`}
      </p>
    </>
  );
}
