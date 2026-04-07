import { Skeleton } from "@/features/shared/components/skeleton";

export default function ListsLoading() {
  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Page header skeleton */}
      <div className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 flex items-start justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton variant="text" className="h-3 w-16" />
          <Skeleton variant="text" className="h-8 w-32" />
        </div>
        <Skeleton variant="text" className="h-11 w-28 rounded-full shrink-0" />
      </div>

      {/* List items skeleton */}
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-4 flex items-center justify-between gap-4"
          >
            <div className="grid gap-1.5 flex-1 min-w-0">
              <Skeleton variant="text" className="h-5 w-40" />
              <Skeleton variant="text" className="h-3 w-24" />
            </div>
            <Skeleton variant="text" className="h-9 w-9 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
