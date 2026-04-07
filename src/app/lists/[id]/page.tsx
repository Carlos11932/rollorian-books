"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useListDetail } from "@/features/lists/hooks/use-list-detail";
import { ListHeader } from "@/features/lists/components/list-header";
import { ListItemGrid } from "@/features/lists/components/list-item-grid";

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("lists");

  const detail = useListDetail(id);

  if (detail.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-muted" style={{ fontSize: "32px" }}>
          progress_activity
        </span>
      </div>
    );
  }

  if (detail.error || !detail.list) {
    return (
      <div className="px-12 md:px-20 pt-8 pb-24">
        <p className="text-error">{detail.error ?? "List not found"}</p>
        <Link href="/lists" className="text-sm text-muted hover:text-text mt-4 inline-block">
          {t("backToLists")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      <Link
        href="/lists"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors w-fit"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        {t("backToLists")}
      </Link>

      <ListHeader
        list={detail.list}
        isEditingName={detail.isEditingName}
        editName={detail.editName}
        setEditName={detail.setEditName}
        startEditingName={detail.startEditingName}
        cancelEditingName={detail.cancelEditingName}
        onSaveName={() => void detail.handleSaveName()}
        isEditingDesc={detail.isEditingDesc}
        editDesc={detail.editDesc}
        setEditDesc={detail.setEditDesc}
        startEditingDesc={detail.startEditingDesc}
        cancelEditingDesc={detail.cancelEditingDesc}
        onSaveDescription={() => void detail.handleSaveDescription()}
        showDeleteConfirm={detail.showDeleteConfirm}
        isDeleting={detail.isDeleting}
        setShowDeleteConfirm={detail.setShowDeleteConfirm}
        onDelete={() => void detail.handleDelete()}
      />

      <ListItemGrid
        items={detail.list.items}
        onRemoveBook={(bookId) => void detail.handleRemoveBook(bookId)}
      />
    </div>
  );
}
