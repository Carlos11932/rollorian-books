import { getTranslations } from 'next-intl/server';

interface StarRatingProps {
  rating: number | null;
}

export async function StarRating({ rating }: StarRatingProps) {
  const t = await getTranslations('common');

  if (rating === null) {
    return <span className="text-xs text-on-surface/40 uppercase tracking-wide">{t('notRated')}</span>;
  }

  return (
    <span aria-label={`Rating: ${rating} out of 5`} className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? "text-secondary text-lg" : "text-on-surface/20 text-lg"}>
          ★
        </span>
      ))}
    </span>
  );
}
