"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/features/shared/components/button";
import type { LoanView } from "@/lib/loans";

interface DashboardLoansClientProps {
  initialLoans: LoanView[];
}

export function DashboardLoansClient({ initialLoans }: DashboardLoansClientProps) {
  const t = useTranslations("loans");
  const [loans, setLoans] = useState<LoanView[]>(initialLoans);

  // Prevent concurrent mutations — tracks which loan IDs have in-flight requests
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function handleAction(loanId: string, action: "accept" | "decline" | "return") {
    // Block concurrent mutations on the same loan
    if (pendingIds.has(loanId)) return;
    setPendingIds((prev) => new Set(prev).add(loanId));

    // Capture current state for rollback BEFORE optimistic update
    const snapshot = [...loans];

    // Optimistic update
    if (action === "decline" || action === "return") {
      setLoans((prev) => prev.filter((l) => l.id !== loanId));
    } else {
      setLoans((prev) =>
        prev.map((l) => (l.id === loanId ? { ...l, status: "ACTIVE" } : l)),
      );
    }

    try {
      const res = await fetch(`/api/loans/${loanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        // Server rejected — rollback optimistic update
        setLoans(snapshot);
        return;
      }

      // Sync with actual server response for accept
      if (action === "accept") {
        const updated = (await res.json()) as LoanView;
        setLoans((prev) => prev.map((l) => (l.id === loanId ? updated : l)));
      }
    } catch {
      // Network error — rollback optimistic update
      setLoans(snapshot);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(loanId);
        return next;
      });
    }
  }

  if (loans.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span
          className="material-symbols-outlined text-primary text-[20px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          swap_horiz
        </span>
        <h2 className="text-lg font-bold text-on-surface">{t("lentBooks")}</h2>
      </div>

      <div className="grid gap-3">
        {loans.map((loan) => (
          <div
            key={loan.id}
            className="flex items-center gap-4 rounded-[var(--radius-xl)] border border-outline-variant/15 bg-surface-container-low/40 p-4"
            style={{ backdropFilter: "blur(8px)" }}
          >
            <Link href={`/books/${loan.bookId}`} className="shrink-0">
              {loan.bookCoverUrl ? (
                <Image
                  src={loan.bookCoverUrl}
                  alt={loan.bookTitle}
                  width={40}
                  height={60}
                  className="rounded-md object-cover w-10 h-[60px]"
                />
              ) : (
                <div className="w-10 h-[60px] rounded-md bg-surface-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-tertiary text-lg">menu_book</span>
                </div>
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <Link href={`/books/${loan.bookId}`} className="hover:text-primary transition-colors">
                <p className="text-sm font-bold text-on-surface truncate">{loan.bookTitle}</p>
              </Link>
              <p className="text-[11px] text-tertiary truncate">
                {loan.bookAuthors.join(", ")}
              </p>
              <p className="text-[10px] text-tertiary mt-0.5">
                {loan.status === "REQUESTED" || loan.status === "OFFERED"
                  ? t("pending")
                  : t("active")}
                {" · "}
                {loan.lenderName ?? "?"} → {loan.borrowerName ?? "?"}
              </p>
            </div>

            <div className="flex gap-2 shrink-0">
              {(loan.status === "REQUESTED" || loan.status === "OFFERED") && (
                <>
                  <Button variant="primary" size="sm" onClick={() => void handleAction(loan.id, "accept")}>
                    {t("accept")}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void handleAction(loan.id, "decline")}>
                    {t("decline")}
                  </Button>
                </>
              )}
              {loan.status === "ACTIVE" && (
                <Button variant="secondary" size="sm" onClick={() => void handleAction(loan.id, "return")}>
                  {t("return")}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
