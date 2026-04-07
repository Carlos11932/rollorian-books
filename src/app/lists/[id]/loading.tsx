import { Skeleton } from "@/features/shared/components/skeleton";

export default function ListDetailLoading() {
  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Back link skeleton */}
      <Skeleton variant="text" className="h-4 w-28" />

      {/* List header skeleton */}
      <div className="card-glass p-6 flex items-start justify-between gap-4">
        <div className="grid gap-2 flex-1">
          <Skeleton variant="text" className="h-8 w-48" />
          <Skeleton variant="text" className="h-4 w-64" />
        </div>
        <Skeleton variant="text" className="h-9 w-20 rounded-full shrink-0" />
      </div>

      {/* Book grid skeleton */}
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
  );
}
