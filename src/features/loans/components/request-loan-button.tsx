"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/features/shared/components/button";

interface RequestLoanButtonProps {
  lenderId: string;
  bookId: string;
}

export function RequestLoanButton({ lenderId, bookId }: RequestLoanButtonProps) {
  const t = useTranslations("loans");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function handleRequest() {
    setState("loading");
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "request", targetUserId: lenderId, bookId }),
      });
      if (res.ok) setState("done");
      else setState("idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <span className="text-xs text-success font-semibold flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">check_circle</span>
        {t("pending")}
      </span>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={state === "loading"}
      onClick={handleRequest}
    >
      {state === "loading" ? t("requesting") : t("requestLoan")}
    </Button>
  );
}
