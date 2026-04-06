"use client";

import { type FormEvent } from "react";
import { useTranslations } from "next-intl";

const QUICK_FILTERS: { labelKey: string; queryValue: string }[] = [
  { labelKey: "search.genres.novel", queryValue: "Novela" },
  { labelKey: "search.genres.history", queryValue: "Historia" },
  { labelKey: "search.genres.scifi", queryValue: "Ciencia Ficción" },
  { labelKey: "search.genres.romance", queryValue: "Romance" },
  { labelKey: "search.genres.philosophy", queryValue: "Filosofía" },
];

interface SearchHeaderProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSearch: (query: string) => void;
  isLoading: boolean;
  hasBarcodeApi: boolean;
  onOpenScanner: () => void;
}

export function SearchHeader({
  inputValue,
  onInputChange,
  onSearch,
  isLoading,
  hasBarcodeApi,
  onOpenScanner,
}: SearchHeaderProps) {
  const t = useTranslations();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSearch(inputValue);
  }

  return (
    <div className="text-center mb-8">
      <h1 className="text-3xl md:text-5xl font-bold text-on-surface tracking-tight mb-8 font-headline">
        {t("search.heading")}
      </h1>

      <form
        onSubmit={handleSubmit}
        role="search"
        className="relative w-full max-w-2xl mx-auto"
      >
        <label htmlFor="search-input" className="sr-only">
          {t("search.inputLabel")}
        </label>

        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-6 flex items-center pointer-events-none"
        >
          <span className="material-symbols-outlined text-primary" style={{ fontSize: "22px" }}>
            search
          </span>
        </span>

        <input
          id="search-input"
          name="query"
          type="search"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={t("search.inputLabel")}
          autoComplete="off"
          spellCheck={false}
          disabled={isLoading}
          className="w-full bg-surface-container-lowest border-none text-on-surface placeholder:text-outline text-lg py-5 pl-16 pr-16 rounded-full shadow-2xl focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {hasBarcodeApi ? (
          <button
            type="button"
            onClick={onOpenScanner}
            className="absolute inset-y-0 right-4 flex items-center text-primary hover:text-primary/80 transition-colors cursor-pointer"
            aria-label={t("search.scanIsbn")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
              qr_code_scanner
            </span>
          </button>
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 right-4 flex items-center pointer-events-none"
          >
            <span className="material-symbols-outlined text-outline" style={{ fontSize: "22px" }}>
              mic
            </span>
          </span>
        )}
      </form>

      <div className="flex flex-wrap justify-center gap-3 mt-8">
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter.labelKey}
            type="button"
            onClick={() => {
              onInputChange(filter.queryValue);
              onSearch(filter.queryValue);
            }}
            className="px-5 py-2 bg-surface-container-high text-on-surface-variant rounded-full text-sm font-medium hover:bg-surface-bright cursor-pointer transition-colors duration-150"
          >
            {t(filter.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
