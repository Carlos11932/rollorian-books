import { Skeleton } from "@/features/shared/components/skeleton";

export default function LibraryLoading() {
  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Status tabs skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            className="h-9 w-20 rounded-full"
          />
        ))}
      </div>

      {/* Rail sections skeleton */}
      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <section
          key={sectionIndex}
          className="card-glass p-6 grid gap-4"
        >
          {/* Section heading */}
          <div className="flex items-end justify-between gap-4">
            <div className="grid gap-1.5">
              <Skeleton variant="text" className="h-3 w-16" />
              <Skeleton variant="text" className="h-7 w-36" />
            </div>
            <Skeleton variant="text" className="h-4 w-16" />
          </div>

          {/* Cards row skeleton */}
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, cardIndex) => (
              <div key={cardIndex} className="shrink-0 flex gap-3 rounded-[var(--radius-md)] border border-line p-3 w-[280px]">
                <Skeleton variant="card" className="w-[56px] h-[84px] shrink-0" />
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton variant="text" className="h-4 w-full" />
                  <Skeleton variant="text" className="h-3 w-3/4" />
                  <Skeleton variant="text" className="h-5 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
