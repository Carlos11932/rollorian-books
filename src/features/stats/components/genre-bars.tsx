interface GenreBarsProps {
  genres: { genre: string; count: number }[];
  title: string;
}

export function GenreBars({ genres, title }: GenreBarsProps) {
  if (genres.length === 0) return null;

  const maxCount = Math.max(...genres.map((g) => g.count), 1);

  return (
    <section className="bg-surface-container-low rounded-2xl p-6">
      <h3 className="text-lg font-bold font-headline text-on-surface mb-6">
        {title}
      </h3>
      <div className="flex flex-col gap-4">
        {genres.map((item) => {
          const widthPercent = (item.count / maxCount) * 100;

          return (
            <div key={item.genre} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface font-medium">
                  {item.genre}
                </span>
                <span className="text-on-surface-variant tabular-nums">
                  {item.count}
                </span>
              </div>
              <div className="h-3 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(widthPercent, 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
