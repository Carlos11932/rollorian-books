interface StarRatingProps {
  rating: number | null;
}

export function StarRating({ rating }: StarRatingProps) {
  if (rating === null) {
    return <span className="text-xs text-on-surface/40 uppercase tracking-wide">Not rated</span>;
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
