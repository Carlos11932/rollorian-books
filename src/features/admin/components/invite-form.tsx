"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function InviteForm() {
  const t = useTranslations("admin");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMessage(data.error ?? t("inviteError"));
        setStatus("error");
        return;
      }

      setEmail("");
      setStatus("idle");
      router.refresh();
    } catch {
      setErrorMessage(t("inviteError"));
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("inviteEmailPlaceholder")}
          required
          disabled={status === "loading"}
          className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-tertiary/50 focus:outline-none focus:border-primary/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === "loading" || !email}
          className="px-5 py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {status === "loading" ? t("inviteSending") : t("inviteButton")}
        </button>
      </div>
      {status === "error" && (
        <p className="text-xs text-error">{errorMessage}</p>
      )}
    </form>
  );
}
