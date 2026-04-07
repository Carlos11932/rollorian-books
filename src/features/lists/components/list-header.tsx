"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/features/shared/components/button";
import type { BookListWithItems } from "@/lib/types/book";

interface ListHeaderProps {
  list: BookListWithItems;
  // Name editing
  isEditingName: boolean;
  editName: string;
  setEditName: (v: string) => void;
  startEditingName: () => void;
  cancelEditingName: () => void;
  onSaveName: () => void;
  // Description editing
  isEditingDesc: boolean;
  editDesc: string;
  setEditDesc: (v: string) => void;
  startEditingDesc: () => void;
  cancelEditingDesc: () => void;
  onSaveDescription: () => void;
  // Delete
  showDeleteConfirm: boolean;
  isDeleting: boolean;
  setShowDeleteConfirm: (v: boolean) => void;
  onDelete: () => void;
}

export function ListHeader({
  list,
  isEditingName,
  editName,
  setEditName,
  startEditingName,
  cancelEditingName,
  onSaveName,
  isEditingDesc,
  editDesc,
  setEditDesc,
  startEditingDesc,
  cancelEditingDesc,
  onSaveDescription,
  showDeleteConfirm,
  isDeleting,
  setShowDeleteConfirm,
  onDelete,
}: ListHeaderProps) {
  const t = useTranslations("lists");
  const tCommon = useTranslations("common");

  return (
    <div
      className="card-glass backdrop-blur-xl p-6"
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
                if (e.key === "Enter") onSaveName();
                if (e.key === "Escape") cancelEditingName();
              }}
              autoFocus
              maxLength={100}
              className="flex-1 rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-lg font-bold px-3 py-1 focus:outline-none focus:border-accent/50"
            />
            <Button size="sm" onClick={onSaveName}>
              {tCommon("save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEditingName}>
              {tCommon("cancel")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1
              className="text-3xl font-bold text-text"
            >
              {list.name}
            </h1>
            <button
              type="button"
              onClick={startEditingName}
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
                if (e.key === "Escape") cancelEditingDesc();
              }}
              autoFocus
              maxLength={500}
              rows={2}
              className="flex-1 rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-sm px-3 py-2 focus:outline-none focus:border-accent/50 resize-none"
            />
            <Button size="sm" onClick={onSaveDescription}>
              {tCommon("save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEditingDesc}>
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
              onClick={startEditingDesc}
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
                onClick={onDelete}
                className="!bg-error/20 !text-error !border-error/30"
              >
                {isDeleting ? t("deleting") : tCommon("delete")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
