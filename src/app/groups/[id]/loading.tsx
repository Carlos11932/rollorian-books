import { Skeleton } from "@/features/shared/components/skeleton";

export default function GroupDetailLoading() {
  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Page header skeleton */}
      <div className="card-glass p-6 flex items-start justify-between gap-4">
        <div className="grid gap-2 flex-1">
          <Skeleton variant="text" className="h-3 w-32" />
          <Skeleton variant="text" className="h-8 w-48" />
          <Skeleton variant="text" className="h-4 w-40" />
        </div>
        <Skeleton variant="text" className="h-9 w-24 rounded-full shrink-0" />
      </div>

      {/* Filter pills skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            className="h-8 w-20 rounded-full"
          />
        ))}
      </div>

      {/* Genre rail sections skeleton */}
      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <section
          key={sectionIndex}
          className="card-glass p-6 grid gap-4"
        >
          <div className="flex items-end justify-between gap-4">
            <Skeleton variant="text" className="h-6 w-36" />
            <Skeleton variant="text" className="h-4 w-16" />
          </div>
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 5 }).map((_, cardIndex) => (
              <div key={cardIndex} className="shrink-0 w-[140px] grid gap-2">
                <Skeleton variant="card" className="h-[200px]" />
                <Skeleton variant="text" className="h-4 w-3/4" />
                <Skeleton variant="text" className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
