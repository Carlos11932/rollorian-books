import { Skeleton } from "@/features/shared/components/skeleton";

export default function BookDetailLoading() {
  return (
    <div className="grid gap-6">
      {/* Back link skeleton */}
      <div>
        <Skeleton variant="text" className="h-4 w-28" />
      </div>

      {/* Hero section skeleton */}
      <div
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 md:p-8"
        style={{ backdropFilter: "blur(16px)" }}
        aria-hidden="true"
      >
        <div className="flex flex-col md:flex-row gap-8">
          {/* Cover skeleton */}
          <div className="shrink-0 flex justify-center md:justify-start">
            <Skeleton className="w-[160px] h-[240px] md:w-[200px] md:h-[300px] rounded-[var(--radius-md)]" />
          </div>

          {/* Metadata skeleton */}
          <div className="flex flex-col gap-4 flex-1">
            <div className="grid gap-2">
              <Skeleton variant="text" className="h-3 w-20" />
              <Skeleton variant="text" className="h-9 w-3/4" />
              <Skeleton variant="text" className="h-5 w-1/2" />
              <Skeleton variant="text" className="h-4 w-40" />
            </div>

            <div className="flex gap-3">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="grid gap-1">
                  <Skeleton variant="text" className="h-3 w-20" />
                  <Skeleton variant="text" className="h-4 w-28" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit form skeleton */}
      <div
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6"
        style={{ backdropFilter: "blur(16px)" }}
        aria-hidden="true"
      >
        <div className="grid gap-4">
          <Skeleton variant="text" className="h-3 w-16" />
          <Skeleton variant="text" className="h-7 w-40" />

          <div className="grid gap-4 mt-2">
            <div className="grid gap-2">
              <Skeleton variant="text" className="h-3 w-12" />
              <Skeleton className="h-10 rounded-[var(--radius-sm)]" />
            </div>
            <div className="grid gap-2">
              <Skeleton variant="text" className="h-3 w-14" />
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-full" />
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Skeleton variant="text" className="h-3 w-10" />
              <Skeleton className="h-24 rounded-[var(--radius-sm)]" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Skeleton className="h-11 w-28 rounded-full" />
            <Skeleton className="h-11 w-28 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
