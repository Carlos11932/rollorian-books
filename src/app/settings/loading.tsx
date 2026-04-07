import { Skeleton } from "@/features/shared/components/skeleton";

export default function SettingsLoading() {
  return (
    <div className="px-12 md:px-20 pt-8 pb-24">
      <div className="max-w-2xl rounded-[var(--radius-xl)] border border-line bg-surface p-8 grid gap-6">
        {/* Title row */}
        <div className="flex items-center gap-3">
          <Skeleton variant="card" className="w-8 h-8 rounded-full shrink-0" />
          <Skeleton variant="text" className="h-8 w-32" />
        </div>

        {/* Content block */}
        <div className="grid gap-3">
          <Skeleton variant="text" className="h-5 w-48" />
          <Skeleton variant="text" className="h-4 w-full" />
          <Skeleton variant="text" className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}
