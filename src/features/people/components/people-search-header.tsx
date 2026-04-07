"use client";

import { useTranslations } from "next-intl";

interface PeopleSearchHeaderProps {
  query: string;
  onQueryChange: (q: string) => void;
}

export function PeopleSearchHeader({ query, onQueryChange }: PeopleSearchHeaderProps) {
  const t = useTranslations("people");

  return (
    <div>
      <h1
        className="text-3xl font-bold text-on-surface mb-2"
      >
        {t("heading")}
      </h1>
      <p className="text-sm text-tertiary mb-6">{t("description")}</p>

      <div className="relative mb-8">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-tertiary text-[20px]">
          search
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container-low/60 text-on-surface text-sm placeholder:text-tertiary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors backdrop-blur"
        />
      </div>
    </div>
  );
}
