import { Skeleton } from "@/features/shared/components/skeleton";

export default function GroupsLoading() {
  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Page header skeleton */}
      <div className="card-glass p-6 flex items-start justify-between gap-4">
        <div className="grid gap-2 flex-1">
          <Skeleton variant="text" className="h-3 w-16" />
          <Skeleton variant="text" className="h-8 w-36" />
          <Skeleton variant="text" className="h-4 w-64" />
        </div>
        <Skeleton variant="text" className="h-10 w-32 rounded-full shrink-0" />
      </div>

      {/* Group list skeleton */}
      <section className="grid gap-4">
        <Skeleton variant="text" className="h-6 w-28" />
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="card-glass p-4 flex items-center justify-between gap-4"
            >
              <div className="grid gap-1 flex-1">
                <Skeleton variant="text" className="h-5 w-40" />
                <Skeleton variant="text" className="h-3 w-24" />
              </div>
              <Skeleton variant="text" className="h-9 w-24 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
