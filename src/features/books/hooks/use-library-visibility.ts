"use client";

import { useState, useEffect } from "react";
import type { BookStatus } from "@/lib/types/book";

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const VISIBILITY_STORAGE_KEY = "library-section-visibility";

type VisibilityMap = Partial<Record<string, boolean>>;

function loadVisibility(): VisibilityMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(VISIBILITY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VisibilityMap) : {};
  } catch {
    return {};
  }
}

function saveVisibility(visibility: VisibilityMap): void {
  try {
    localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    // localStorage unavailable — silent fail
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface LibraryVisibility {
  isSectionVisible: (status: BookStatus) => boolean;
  toggleSectionVisibility: (status: BookStatus) => void;
}

/**
 * Manages section collapse/expand state with localStorage persistence.
 * Starts with empty state (matches SSR) then syncs from localStorage in
 * a useEffect to avoid hydration mismatches.
 */
export function useLibraryVisibility(): LibraryVisibility {
  const [sectionVisibility, setSectionVisibility] = useState<VisibilityMap>({});

  useEffect(() => {
    const visibility = loadVisibility();
    const timeoutId = window.setTimeout(() => {
      setSectionVisibility(visibility);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  function isSectionVisible(status: BookStatus): boolean {
    return sectionVisibility[status] ?? true;
  }

  function toggleSectionVisibility(status: BookStatus): void {
    setSectionVisibility((prev) => {
      const next = { ...prev, [status]: !(prev[status] ?? true) };
      saveVisibility(next);
      return next;
    });
  }

  return { isSectionVisible, toggleSectionVisibility };
}
