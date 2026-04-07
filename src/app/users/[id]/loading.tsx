import { Skeleton } from "@/features/shared/components/skeleton";

export default function UserProfileLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Profile header skeleton */}
      <div className="card-glass p-6 flex flex-col items-center gap-4 text-center">
        <Skeleton variant="card" className="w-20 h-20 rounded-full" />
        <div className="grid gap-2">
          <Skeleton variant="text" className="h-6 w-36 mx-auto" />
          <div className="flex gap-6 justify-center">
            <Skeleton variant="text" className="h-4 w-16" />
            <Skeleton variant="text" className="h-4 w-16" />
            <Skeleton variant="text" className="h-4 w-16" />
          </div>
        </div>
        <Skeleton variant="text" className="h-9 w-28 rounded-full" />
      </div>

      {/* Books section skeleton */}
      <section className="grid gap-4">
        <Skeleton variant="text" className="h-6 w-32" />
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid gap-2">
              <Skeleton variant="card" className="h-[200px]" />
              <Skeleton variant="text" className="h-4 w-3/4" />
              <Skeleton variant="text" className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
