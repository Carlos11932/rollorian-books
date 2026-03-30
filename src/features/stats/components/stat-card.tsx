interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  subtext?: string;
}

export function StatCard({ icon, label, value, subtext }: StatCardProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-primary">
        <span className="material-symbols-outlined text-[24px]">{icon}</span>
        <span className="text-sm font-medium text-on-surface-variant">
          {label}
        </span>
      </div>
      <p className="text-3xl font-bold font-headline text-on-surface">
        {value}
      </p>
      {subtext != null && (
        <p className="text-xs text-on-surface-variant">{subtext}</p>
      )}
    </div>
  );
}
