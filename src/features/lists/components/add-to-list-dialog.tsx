"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { BookListSummary } from "@/lib/types/book";
import { fetchLists, addToList, createList, removeFromList } from "@/lib/api/lists";
import { ApiError } from "@/lib/api/lists";

interface AddToListDialogProps {
  bookId: string;
  open: boolean;
  onClose: () => void;
}

export function AddToListDialog({ bookId, open, onClose }: AddToListDialogProps) {
  const t = useTranslations("lists");
  const tCommon = useTranslations("common");

  const [lists, setLists] = useState<BookListSummary[]>([]);
  const [bookListIds, setBookListIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const loadLists = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchLists();
      setLists(data);

      // Determine which lists already contain this book by checking each list
      // We use a lightweight approach: fetch all lists and for each, check items
      const inListIds = new Set<string>();
      for (const list of data) {
        try {
          const res = await fetch(`/api/lists/${list.id}`);
          if (res.ok) {
            const fullList = await res.json();
            const items = fullList.items as Array<{ bookId: string }>;
            if (items.some((item) => item.bookId === bookId)) {
              inListIds.add(list.id);
            }
          }
        } catch {
          // Non-critical
        }
      }
      setBookListIds(inListIds);
    } catch {
      // Non-critical
    } finally {
      setIsLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    if (open) {
      void loadLists();
    }
  }, [open, loadLists]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay to avoid closing immediately from the trigger click
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose]);

  async function handleToggle(listId: string) {
    const isInList = bookListIds.has(listId);
    try {
      if (isInList) {
        await removeFromList(listId, bookId);
        setBookListIds((prev) => {
          const next = new Set(prev);
          next.delete(listId);
          return next;
        });
      } else {
        await addToList(listId, bookId);
        setBookListIds((prev) => new Set(prev).add(listId));
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Already in list — mark it
        setBookListIds((prev) => new Set(prev).add(listId));
      }
    }
  }

  async function handleCreateAndAdd() {
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const created = await createList({ name: newName.trim() });
      await addToList(created.id, bookId);
      setLists((prev) => [created, ...prev]);
      setBookListIds((prev) => new Set(prev).add(created.id));
      setNewName("");
      setShowCreate(false);
    } catch {
      // Non-critical
    } finally {
      setIsCreating(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-[var(--radius-xl)] border border-line bg-surface p-5 shadow-2xl grid gap-4"
        role="dialog"
        aria-label={t("addToList")}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text" style={{ fontFamily: "var(--font-headline)" }}>
            {t("addToList")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-text transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <span className="material-symbols-outlined animate-spin text-muted" style={{ fontSize: "24px" }}>
              progress_activity
            </span>
          </div>
        )}

        {/* Lists */}
        {!isLoading && (
          <div className="grid gap-1 max-h-[300px] overflow-y-auto">
            {lists.length === 0 && !showCreate && (
              <p className="text-sm text-muted py-2">{t("empty")}</p>
            )}
            {lists.map((list) => {
              const isInList = bookListIds.has(list.id);
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => void handleToggle(list.id)}
                  className={cn(
                    "flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                    "hover:bg-white/5",
                    isInList && "bg-primary/10",
                  )}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    {isInList ? "check_box" : "check_box_outline_blank"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{list.name}</p>
                    <p className="text-xs text-muted">
                      {t("bookCount", { count: list._count.items })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Create new list */}
        {!isLoading && (
          <>
            {showCreate ? (
              <div className="grid gap-2 border-t border-line pt-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreateAndAdd();
                    if (e.key === "Escape") setShowCreate(false);
                  }}
                  placeholder={t("name")}
                  maxLength={100}
                  autoFocus
                  className="rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-sm px-3 py-2 focus:outline-none focus:border-accent/50"
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="text-xs text-muted hover:text-text"
                  >
                    {tCommon("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCreateAndAdd()}
                    disabled={!newName.trim() || isCreating}
                    className="text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? t("saving") : t("create")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors border-t border-line pt-3"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                {t("createNew")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
