"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { BookListWithItems } from "@/lib/types/book";
import { fetchList, updateList, deleteList, removeFromList } from "@/lib/api/lists";
import { EmptyState } from "@/features/shared/components/empty-state";
import { Button } from "@/features/shared/components/button";

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("lists");
  const tCommon = useTranslations("common");

  const [list, setList] = useState<BookListWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const data = await fetchList(id);
      setList(data);
    } catch {
      setError("Failed to load list");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function handleSaveName() {
    if (!editName.trim() || !list) return;
    try {
      await updateList(id, { name: editName.trim() });
      setList({ ...list, name: editName.trim() });
      setIsEditingName(false);
    } catch {
      // Keep editing state on failure
    }
  }

  async function handleSaveDescription() {
    if (!list) return;
    const value = editDesc.trim() || null;
    try {
      await updateList(id, { description: value });
      setList({ ...list, description: value });
      setIsEditingDesc(false);
    } catch {
      // Keep editing state on failure
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteList(id);
      router.push("/lists");
    } catch {
      setIsDeleting(false);
    }
  }

  async function handleRemoveBook(bookId: string) {
    if (!list) return;
    try {
      await removeFromList(id, bookId);
      setList({
        ...list,
        items: list.items.filter((item) => item.bookId !== bookId),
      });
    } catch {
      // Non-critical
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-muted" style={{ fontSize: "32px" }}>
          progress_activity
        </span>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="px-12 md:px-20 pt-8 pb-24">
        <p className="text-error">{error ?? "List not found"}</p>
        <Link href="/lists" className="text-sm text-muted hover:text-text mt-4 inline-block">
          {t("backToLists")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Back link */}
      <Link
        href="/lists"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors w-fit"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        {t("backToLists")}
      </Link>

      {/* Header */}
      <div
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <div className="grid gap-3">
          {/* Name */}
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveName();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
                autoFocus
                maxLength={100}
                className="flex-1 rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-lg font-bold px-3 py-1 focus:outline-none focus:border-accent/50"
                style={{ fontFamily: "var(--font-headline)" }}
              />
              <Button size="sm" onClick={() => void handleSaveName()}>
                {tCommon("save")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)}>
                {tCommon("cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1
                className="text-3xl font-bold text-text"
                style={{ fontFamily: "var(--font-headline)" }}
              >
                {list.name}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setEditName(list.name);
                  setIsEditingName(true);
                }}
                className="text-muted hover:text-text transition-colors"
                aria-label={t("editName")}
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            </div>
          )}

          {/* Description */}
          {isEditingDesc ? (
            <div className="flex items-start gap-2">
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsEditingDesc(false);
                }}
                autoFocus
                maxLength={500}
                rows={2}
                className="flex-1 rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-sm px-3 py-2 focus:outline-none focus:border-accent/50 resize-none"
              />
              <Button size="sm" onClick={() => void handleSaveDescription()}>
                {tCommon("save")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingDesc(false)}>
                {tCommon("cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted">
                {list.description ?? t("description")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditDesc(list.description ?? "");
                  setIsEditingDesc(true);
                }}
                className="text-muted hover:text-text transition-colors"
                aria-label={t("editDescription")}
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
              </button>
            </div>
          )}

          {/* Book count + delete */}
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted">
              {t("bookCount", { count: list.items.length })}
            </p>

            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-error/70 hover:text-error transition-colors"
              >
                {tCommon("delete")}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-error">{t("deleteWarning")}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  size="sm"
                  loading={isDeleting}
                  onClick={() => void handleDelete()}
                  className="!bg-error/20 !text-error !border-error/30"
                >
                  {isDeleting ? t("deleting") : tCommon("delete")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Books in list */}
      {list.items.length === 0 ? (
        <EmptyState
          title={t("emptyList")}
          description={t("emptyListDescription")}
          icon={
            <span className="material-symbols-outlined" style={{ fontSize: "48px" }}>
              menu_book
            </span>
          }
        />
      ) : (
        <div className="grid gap-3">
          {list.items.map((item) => (
            <div
              key={item.id}
              className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-4 flex items-center gap-4"
              style={{ backdropFilter: "blur(16px)" }}
            >
              {/* Book cover thumbnail */}
              <Link href={`/books/${item.book.id}`} className="shrink-0">
                <div className="w-[48px] h-[72px] rounded-md overflow-hidden bg-surface-container-high relative">
                  {item.book.coverUrl != null ? (
                    <Image
                      src={item.book.coverUrl}
                      alt={item.book.title}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-muted" style={{ fontSize: "20px" }}>
                        menu_book
                      </span>
                    </div>
                  )}
                </div>
              </Link>

              {/* Book info */}
              <div className="flex-1 min-w-0 grid gap-0.5">
                <Link href={`/books/${item.book.id}`} className="hover:underline">
                  <p className="font-semibold text-on-surface truncate text-sm">
                    {item.book.title}
                  </p>
                </Link>
                <p className="text-xs text-muted truncate">
                  {item.book.authors.length > 0 ? item.book.authors.join(", ") : ""}
                </p>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => void handleRemoveBook(item.bookId)}
                className="shrink-0 text-muted hover:text-error transition-colors p-1"
                aria-label={t("removeFromList")}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
