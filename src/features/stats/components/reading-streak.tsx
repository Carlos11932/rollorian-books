"use client";

import { useTranslations } from "next-intl";

interface ReadingStreakProps {
  current: number;
  unit: "days" | "weeks";
}

export function ReadingStreak({ current, unit }: ReadingStreakProps) {
  const t = useTranslations("stats");

  const streakText =
    current === 0
      ? t("noStreak")
      : unit === "weeks"
        ? t("streakWeeks", { count: current })
        : t("streakDays", { count: current });

  return (
    <section className="bg-surface-container-low rounded-2xl p-6">
      <h3 className="text-lg font-bold font-headline text-on-surface mb-4">
        {t("readingStreak")}
      </h3>
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
          <span
            className="material-symbols-outlined text-primary text-[32px]"
          >
            local_fire_department
          </span>
        </div>
        <div>
          {current > 0 && (
            <p className="text-3xl font-bold font-headline text-on-surface">
              {current}
            </p>
          )}
          <p className="text-sm text-on-surface-variant">{streakText}</p>
        </div>
      </div>
    </section>
  );
}
