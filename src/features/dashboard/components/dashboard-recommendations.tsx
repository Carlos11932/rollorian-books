import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Recommendation } from "@/lib/recommendations/get-recommendations";

interface DashboardRecommendationsProps {
  recommendations: Recommendation[];
}

export async function DashboardRecommendations({ recommendations }: DashboardRecommendationsProps) {
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

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
          {recommendations.slice(0, 10).map((rec) => {
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
