"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { BookListSummary } from "@/lib/types/book";
import { fetchLists } from "@/lib/api/lists";
import { EmptyState } from "@/features/shared/components/empty-state";
import { CreateListForm } from "@/features/lists/components/create-list-form";

export default function ListsPage() {
  const t = useTranslations("lists");

  const [lists, setLists] = useState<BookListSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function loadLists() {
    try {
      const data = await fetchLists();
      setLists(data);
    } catch {
      // Non-critical — page still renders
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCreated() {
    setShowCreate(false);
    void loadLists();
  }

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Page header */}
      <div
        className="card-glass backdrop-blur-xl p-6 flex items-start justify-between gap-4"
      >
        <div className="grid gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            {t("title")}
          </p>
          <h1
            className="text-3xl font-bold text-text"
          >
            {t("title")}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-br from-accent to-accent-strong text-white text-sm font-bold transition-transform hover:-translate-y-px active:translate-y-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t("create")}
        </button>
      </div>

      {/* Create list form */}
      {showCreate && (
        <div className="rounded-[var(--radius-xl)] border border-line bg-surface p-6">
          <CreateListForm
            onCreated={handleCreated}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-muted text-[32px]">
            progress_activity
          </span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && lists.length === 0 && (
        <EmptyState
          title={t("empty")}
          description={t("createFirst")}
          icon={
            <span className="material-symbols-outlined text-[48px]">
              playlist_add
            </span>
          }
          action={
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-br from-accent to-accent-strong text-white text-sm font-bold"
            >
              {t("create")}
            </button>
          }
        />
      )}

      {/* Lists grid */}
      {!isLoading && lists.length > 0 && (
        <div className="grid gap-3">
          {lists.map((list) => (
            <div
              key={list.id}
              className="card-glass backdrop-blur-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="grid gap-0.5 min-w-0">
                <p className="font-semibold text-on-surface truncate">{list.name}</p>
                {list.description && (
                  <p className="text-sm text-muted truncate">{list.description}</p>
                )}
                <p className="text-xs text-muted">
                  {t("bookCount", { count: list._count.items })}
                </p>
              </div>
              <Link
                href={`/lists/${list.id}`}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 text-text border border-line text-sm font-medium hover:-translate-y-px transition-transform"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
