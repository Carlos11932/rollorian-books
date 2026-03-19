import Link from "next/link";

interface CardOverlayProps {
  bookId: string;
  title: string;
  authors: string[];
}

export function CardOverlay({ bookId, title, authors }: CardOverlayProps) {
  const authorLine = authors.length > 0 ? authors.join(", ") : "Unknown author";

  return (
    <div
      className="absolute inset-0 flex flex-col justify-end p-3 rounded-[var(--radius-md)] opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-250 z-10"
      style={{
        background:
          "linear-gradient(to top, rgba(8,11,18,0.92) 0%, rgba(8,11,18,0.4) 50%, transparent 100%)",
      }}
    >
      <p
        className="text-[1.05rem] font-bold text-text mb-1 whitespace-nowrap overflow-hidden text-ellipsis"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </p>
      <p className="text-[0.8rem] text-muted mb-2 whitespace-nowrap overflow-hidden text-ellipsis">
        {authorLine}
      </p>
      <Link
        href={`/books/${bookId}`}
        className="inline-flex items-center self-start px-3 py-1.5 rounded-full text-xs font-bold bg-accent text-white hover:bg-accent-strong transition-colors duration-150"
      >
        Ver detalles
      </Link>
    </div>
  );
}
