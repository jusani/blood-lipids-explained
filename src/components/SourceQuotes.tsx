import { useApp } from '../app';
import { pack } from '../content';
import { sourceTitle } from '../results/present';

/** The quoted source lines behind some claims, each with a link to open the source. */
export function SourceQuotes({ claimIds }: { claimIds: string[] }) {
  const { t } = useApp();
  const claims = [...new Set(claimIds)].map((id) => pack.rules.claims.find((c) => c.id === id)).filter((c) => c?.quotes?.length);
  return (
    <>
      {claims.map((c) => c!.quotes!.map((q, i) => {
        const s = pack.sources.find((x) => x.id === q.source);
        if (!s) return null;
        return (
          <figure class="quote" key={`${c!.id}-${i}`}>
            <figcaption>{t('quote_from', { source: sourceTitle(s.citation) })}</figcaption>
            <blockquote lang="en">{q.quote}</blockquote>
            <a href={s.open_link} target="_blank" rel="noopener noreferrer" class="small">{s.citation}{q.locator ? `, ${q.locator}` : ''}</a>
          </figure>
        );
      }))}
    </>
  );
}
