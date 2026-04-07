import { Skeleton } from "@/features/shared/components/skeleton";

export default function AdminLoading() {
  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Page header skeleton */}
      <div className="card-glass p-6 grid gap-2">
        <Skeleton variant="text" className="h-3 w-16" />
        <Skeleton variant="text" className="h-8 w-36" />
        <Skeleton variant="text" className="h-4 w-64" />
      </div>

      {/* Invite section skeleton */}
      <section className="card-glass p-6 grid gap-4">
        <Skeleton variant="text" className="h-6 w-32" />
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </section>

      {/* Invitations list skeleton */}
      <section className="card-glass p-6 grid gap-4">
        <Skeleton variant="text" className="h-6 w-40" />
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-line">
              <Skeleton variant="text" className="h-4 w-48" />
              <Skeleton variant="text" className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      {/* Users list skeleton */}
      <section className="card-glass p-6 grid gap-4">
        <Skeleton variant="text" className="h-6 w-24" />
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton variant="card" className="w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 grid gap-1">
                <Skeleton variant="text" className="h-4 w-32" />
                <Skeleton variant="text" className="h-3 w-48" />
              </div>
              <Skeleton variant="text" className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
