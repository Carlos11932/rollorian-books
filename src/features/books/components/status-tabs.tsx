'use client';

import Link from "next/link";
import { useTranslations } from 'next-intl';
import { cn } from "@/lib/cn";

const STATUS_TAB = {
  ALL: "all",
  WISHLIST: "WISHLIST",
  TO_READ: "TO_READ",
  READING: "READING",
  REREADING: "REREADING",
  READ: "READ",
  ON_HOLD: "ON_HOLD",
} as const;

type StatusTabValue = (typeof STATUS_TAB)[keyof typeof STATUS_TAB];

interface StatusCounts {
  WISHLIST: number;
  TO_READ: number;
  READING: number;
  REREADING: number;
  READ: number;
  ON_HOLD: number;
}

interface StatusTabsProps {
  activeStatus: StatusTabValue;
  counts: StatusCounts;
  basePath?: string;
  searchParams?: Record<string, string>;
}

const ALL_TABS: StatusTabValue[] = [
  STATUS_TAB.ALL,
  STATUS_TAB.READING,
  STATUS_TAB.REREADING,
  STATUS_TAB.TO_READ,
  STATUS_TAB.READ,
  STATUS_TAB.ON_HOLD,
  STATUS_TAB.WISHLIST,
];

function getTabCount(tab: StatusTabValue, counts: StatusCounts): number | null {
  if (tab === STATUS_TAB.ALL) return null;
  return counts[tab as keyof StatusCounts];
}

function getTabHref(
  tab: StatusTabValue,
  basePath: string,
  searchParams: Record<string, string> = {},
): string {
  const params = new URLSearchParams(searchParams);
  if (tab === STATUS_TAB.ALL) {
    params.delete("status");
  } else {
    params.set("status", tab);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function StatusTabs({ activeStatus, counts, basePath = "/library", searchParams }: StatusTabsProps) {
  const t = useTranslations();

  function getTabLabel(tab: StatusTabValue): string {
    if (tab === STATUS_TAB.ALL) return t('library.tabAll');
    return t(`book.status.${tab}`);
  }

  return (
    <nav
      role="tablist"
      aria-label={t('library.statusesAriaLabel')}
      className="flex flex-wrap gap-2"
    >
      {ALL_TABS.map((tab) => {
        const isActive = tab === activeStatus;
        const count = getTabCount(tab, counts);

        return (
          <Link
            key={tab}
            href={getTabHref(tab, basePath, searchParams)}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
              isActive
                ? "bg-gradient-to-br from-accent to-accent-strong text-white border border-transparent"
                : "bg-white/6 text-muted border border-white/12 hover:text-text hover:-translate-y-px",
            )}
          >
            {getTabLabel(tab)}
            {count !== null && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[1.2rem] h-5 px-1 rounded-full text-xs tabular-nums",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-muted",
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export type { StatusTabValue, StatusCounts };
