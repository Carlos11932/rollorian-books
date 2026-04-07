"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { BookListWithItems } from "@/lib/types/book";
import { fetchList, updateList, deleteList, removeFromList } from "@/lib/api/lists";

export interface UseListDetailReturn {
  list: BookListWithItems | null;
  isLoading: boolean;
  error: string | null;
  // Inline editing — name
  isEditingName: boolean;
  editName: string;
  setEditName: (v: string) => void;
  startEditingName: () => void;
  cancelEditingName: () => void;
  handleSaveName: () => Promise<void>;
  // Inline editing — description
  isEditingDesc: boolean;
  editDesc: string;
  setEditDesc: (v: string) => void;
  startEditingDesc: () => void;
  cancelEditingDesc: () => void;
  handleSaveDescription: () => Promise<void>;
  // Delete
  showDeleteConfirm: boolean;
  isDeleting: boolean;
  setShowDeleteConfirm: (v: boolean) => void;
  handleDelete: () => Promise<void>;
  // Items
  handleRemoveBook: (bookId: string) => Promise<void>;
}

export function useListDetail(id: string): UseListDetailReturn {
  const router = useRouter();

  const [list, setList] = useState<BookListWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline editing — name
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");

  // Inline editing — description
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadList() {
      try {
        const data = await fetchList(id);
        setList(data);
      } catch {
        setError("Failed to load list");
      } finally {
        setIsLoading(false);
      }
    }
    void loadList();
  }, [id]);

  function startEditingName() {
    if (!list) return;
    setEditName(list.name);
    setIsEditingName(true);
  }

  function cancelEditingName() {
    setIsEditingName(false);
  }

  function startEditingDesc() {
    if (!list) return;
    setEditDesc(list.description ?? "");
    setIsEditingDesc(true);
  }

  function cancelEditingDesc() {
    setIsEditingDesc(false);
  }

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

  return {
    list,
    isLoading,
    error,
    isEditingName,
    editName,
    setEditName,
    startEditingName,
    cancelEditingName,
    handleSaveName,
    isEditingDesc,
    editDesc,
    setEditDesc,
    startEditingDesc,
    cancelEditingDesc,
    handleSaveDescription,
    showDeleteConfirm,
    isDeleting,
    setShowDeleteConfirm,
    handleDelete,
    handleRemoveBook,
  };
}
