"use client";

const GENRES = [
  {
    label: "Historia",
    icon: "history_edu",
    span: "md:col-span-2 md:row-span-2",
    labelTag: "Anthology",
  },
  {
    label: "Romance",
    icon: "favorite",
    span: "md:col-span-1 md:row-span-1",
    labelTag: null,
  },
  {
    label: "Ciencia Ficción",
    icon: "rocket_launch",
    span: "md:col-span-1 md:row-span-1",
    labelTag: null,
  },
  {
    label: "Filosofía",
    icon: "psychology",
    span: "md:col-span-1 md:row-span-1",
    labelTag: null,
  },
  {
    label: "Misterio",
    icon: "search",
    span: "md:col-span-1 md:row-span-1",
    labelTag: null,
  },
];

interface GenreBentoGridProps {
  onGenreClick: (genre: string) => void;
}

export function GenreBentoGrid({ onGenreClick }: GenreBentoGridProps) {
  return (
    <section className="mb-16" aria-label="Géneros">
      <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-4 h-auto md:h-[450px]">
        {GENRES.map((genre) => (
          <button
            key={genre.label}
            type="button"
            onClick={() => onGenreClick(genre.label)}
            className={[
              genre.span,
              "rounded-xl overflow-hidden relative group cursor-pointer bg-surface-container-low text-left",
            ].join(" ")}
          >
            {/* Background icon — decorative */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-primary/20"
                style={{ fontSize: "96px" }}
              >
                {genre.icon}
              </span>
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />

            {/* Text content */}
            <div className="absolute bottom-0 p-6">
              {genre.labelTag != null && (
                <span className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1">
                  {genre.labelTag}
                </span>
              )}
              <span className="text-xl font-bold text-primary font-headline">
                {genre.label}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
