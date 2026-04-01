"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/features/shared/components/skeleton";

interface RecommendedBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
}

interface Recommendation {
  book: RecommendedBook;
  readerCount: number;
}

export function DashboardRecommendations() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/recommendations")
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<{ recommendations: Recommendation[] }>;
      })
      .then((data) => setRecommendations(data.recommendations.slice(0, 10)))
      .catch(() => {
        /* non-critical */
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <section>
        <Skeleton variant="text" className="h-7 w-48 mb-4" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="w-32 h-52 rounded-xl shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-bold text-on-surface mb-4">
        {t("recommendations")}
      </h2>
      {recommendations.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-6 text-center">
          <span
            className="material-symbols-outlined text-tertiary mb-2 block"
            style={{ fontSize: "36px" }}
          >
            explore
          </span>
          <p className="text-sm text-tertiary">
            {t("recommendationsEmpty")}
          </p>
        </div>
      ) : (
      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-3">
        {recommendations.map((rec) => {
          const authorLine =
            rec.book.authors.length > 0
              ? rec.book.authors.join(", ")
              : tCommon("unknownAuthor");

          return (
            <Link
              key={rec.book.id}
              href={`/books/${rec.book.id}`}
              className="flex-none w-32 group"
            >
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-container-low transition-transform duration-200 group-hover:scale-105">
                {rec.book.coverUrl ? (
                  <Image
                    src={rec.book.coverUrl}
                    alt={rec.book.title}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-tertiary text-3xl">
                      menu_book
                    </span>
                  </div>
                )}
              </div>
              <h3 className="mt-2 text-xs font-bold text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                {rec.book.title}
              </h3>
              <p className="text-[10px] text-tertiary truncate">{authorLine}</p>
            </Link>
          );
        })}
      </div>
      )}
    </section>
  );
}
