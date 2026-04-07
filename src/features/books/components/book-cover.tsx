import Image from "next/image";
import { cn } from "@/lib/cn";

const COVER_TONE = {
  warm: "warm",
  cool: "cool",
} as const;

type CoverTone = (typeof COVER_TONE)[keyof typeof COVER_TONE];

interface BookCoverProps {
  coverUrl: string | null | undefined;
  title: string;
  tone?: CoverTone;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

export function BookCover({
  coverUrl,
  title,
  tone = COVER_TONE.cool,
  className,
  priority = false,
  sizes = "(max-width: 768px) 118px, 118px",
}: BookCoverProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-md)] border border-line",
        tone === COVER_TONE.cool && "bg-gradient-to-b from-[#30465d] to-[#1a2736]",
        tone === COVER_TONE.warm && "bg-gradient-to-b from-[#6a2a2c] to-[#23151b]",
        className,
      )}
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={`${title} cover`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 grid place-items-center p-3 text-center text-text/60 text-xs leading-snug"
          
          aria-label={`No cover image for ${title}`}
        >
          {title}
        </div>
      )}
    </div>
  );
}
