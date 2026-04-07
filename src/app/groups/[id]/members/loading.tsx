import { Skeleton } from "@/features/shared/components/skeleton";

export default function GroupMembersLoading() {
  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Page header skeleton */}
      <div className="card-glass p-6 grid gap-2">
        <Skeleton variant="text" className="h-3 w-48" />
        <Skeleton variant="text" className="h-8 w-32" />
        <Skeleton variant="text" className="h-4 w-56" />
      </div>

      {/* Invite form skeleton */}
      <section className="card-glass p-6 grid gap-3">
        <Skeleton variant="text" className="h-5 w-28" />
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </section>

      {/* Members list skeleton */}
      <section className="card-glass p-6 grid gap-4">
        <Skeleton variant="text" className="h-5 w-24" />
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3">
                <Skeleton variant="card" className="w-9 h-9 rounded-full shrink-0" />
                <div className="grid gap-1">
                  <Skeleton variant="text" className="h-4 w-28" />
                  <Skeleton variant="text" className="h-4 w-14 rounded-full" />
                </div>
              </div>
              <Skeleton variant="text" className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
