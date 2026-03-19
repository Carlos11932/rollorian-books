import { Skeleton } from "@/features/shared/components/skeleton";

export default function SearchLoading() {
  return (
    <div className="grid gap-6">
      {/* Header skeleton */}
      <div
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 grid gap-6"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <div className="grid gap-3 text-center">
          <Skeleton variant="text" className="h-3 w-16 mx-auto" />
          <Skeleton variant="text" className="h-8 w-56 mx-auto" />
          <Skeleton variant="text" className="h-4 w-80 mx-auto" />
        </div>
        <div className="flex flex-col gap-3 w-full max-w-2xl mx-auto">
          <Skeleton className="h-[56px] rounded-full" />
          <div className="flex gap-3 justify-center">
            <Skeleton className="h-11 w-24 rounded-full" />
          </div>
        </div>
      </div>

      {/* Results skeleton */}
      <div
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 grid gap-4"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <div className="flex items-end justify-between gap-4">
          <div className="grid gap-1">
            <Skeleton variant="text" className="h-3 w-14" />
            <Skeleton variant="text" className="h-7 w-36" />
          </div>
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
          aria-hidden="true"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid gap-2">
              <Skeleton variant="card" className="h-[220px]" />
              <Skeleton variant="text" className="h-4 w-3/4" />
              <Skeleton variant="text" className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
