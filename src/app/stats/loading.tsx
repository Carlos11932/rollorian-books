import { Skeleton } from "@/features/shared/components/skeleton";

export default function StatsLoading() {
  return (
    <div className="pt-8 px-12 md:px-20 pb-24">
      <Skeleton variant="text" className="h-10 w-64 mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton variant="card" className="h-56 rounded-2xl mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton variant="card" className="h-48 rounded-2xl" />
        <Skeleton variant="card" className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}
