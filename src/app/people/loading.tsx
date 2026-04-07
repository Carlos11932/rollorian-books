import { Skeleton } from "@/features/shared/components/skeleton";

export default function PeopleLoading() {
  return (
    <div className="px-12 md:px-20 pt-8 pb-24 max-w-3xl grid gap-6">
      {/* Search header skeleton */}
      <div className="grid gap-3">
        <Skeleton variant="text" className="h-8 w-36" />
        <Skeleton className="h-[48px] rounded-full" />
      </div>

      {/* People list skeleton */}
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="card-glass p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <Skeleton variant="card" className="w-10 h-10 rounded-full shrink-0" />
              <div className="grid gap-1">
                <Skeleton variant="text" className="h-4 w-32" />
                <Skeleton variant="text" className="h-3 w-20" />
              </div>
            </div>
            <Skeleton variant="text" className="h-9 w-24 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
