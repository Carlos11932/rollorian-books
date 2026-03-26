import { getTranslations } from 'next-intl/server';

interface MetadataCardProps {
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  isbn10: string | null;
  isbn13: string | null;
  genres: string[];
}

export async function MetadataCard({ publisher, publishedDate, pageCount, isbn10, isbn13, genres }: MetadataCardProps) {
  const hasContent = publisher ?? publishedDate ?? pageCount ?? isbn13 ?? isbn10 ?? genres.length > 0;

  if (!hasContent) return null;

  const t = await getTranslations('book');

  return (
    <section
      className="rounded-[var(--radius-xl)] border border-outline-variant/30 p-6"
      style={{ backdropFilter: "blur(20px)", background: "rgba(255,255,255,0.04)" }}
      aria-label="Book metadata"
    >
      <h2
        className="text-xs font-bold uppercase tracking-widest text-on-surface/40 mb-4"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        {t('details')}
      </h2>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        {publisher && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-on-surface/40">{t('publisher')}</dt>
            <dd className="text-sm text-on-surface mt-0.5">{publisher}</dd>
          </div>
        )}
        {publishedDate && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-on-surface/40">{t('published')}</dt>
            <dd className="text-sm text-on-surface mt-0.5">{publishedDate}</dd>
          </div>
        )}
        {pageCount && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-on-surface/40">{t('pages')}</dt>
            <dd className="text-sm text-on-surface mt-0.5">{pageCount.toLocaleString()}</dd>
          </div>
        )}
        {(isbn13 ?? isbn10) && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-on-surface/40">{t('isbn')}</dt>
            <dd className="text-sm text-on-surface mt-0.5 font-mono text-xs">{isbn13 ?? isbn10}</dd>
          </div>
        )}
        {genres.length > 0 && (
          <div className="col-span-2">
            <dt className="text-xs font-bold uppercase tracking-wide text-on-surface/40">{t('genres')}</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {genres.map((genre) => (
                <span
                  key={genre}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border border-outline-variant/30 bg-white/5 text-on-surface/60"
                >
                  {genre}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
