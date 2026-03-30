interface MonthlyChartProps {
  data: { month: string; count: number }[];
  title: string;
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function MonthlyChart({ data, title }: MonthlyChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <section className="bg-surface-container-low rounded-2xl p-6">
      <h3 className="text-lg font-bold font-headline text-on-surface mb-6">
        {title}
      </h3>
      <div className="flex items-end gap-2 h-40">
        {data.map((item) => {
          const heightPercent = (item.count / maxCount) * 100;
          // Extract month index from YYYY-MM
          const monthIndex = parseInt(item.month.split("-")[1]!, 10) - 1;
          const label = MONTH_ABBR[monthIndex] ?? item.month;

          return (
            <div
              key={item.month}
              className="flex-1 flex flex-col items-center justify-end h-full gap-1"
            >
              {item.count > 0 && (
                <span className="text-xs font-medium text-on-surface-variant">
                  {item.count}
                </span>
              )}
              <div
                className="w-full rounded-t-md bg-primary/80 transition-all duration-300 min-w-[8px]"
                style={{ height: `${Math.max(heightPercent, item.count > 0 ? 8 : 2)}%` }}
              />
              <span className="text-[10px] text-on-surface-variant mt-1">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
