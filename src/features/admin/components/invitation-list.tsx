"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface Invitation {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED";
  createdAt: string;
  expiresAt: string;
  invitedBy: { id: string; name: string | null };
}

interface InvitationListProps {
  invitations: Invitation[];
}

export function InvitationList({ invitations }: InvitationListProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleRevoke(id: string) {
    setRevokingId(id);
    try {
      await fetch(`/api/admin/invitations/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setRevokingId(null);
    }
  }

  if (invitations.length === 0) {
    return (
      <p className="text-sm text-tertiary py-4">{t("noInvitations")}</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-outline-variant/20">
            <th className="text-left py-2 px-3 text-xs font-semibold text-tertiary uppercase tracking-wider">
              {t("invitationEmail")}
            </th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-tertiary uppercase tracking-wider">
              {t("invitationStatus")}
            </th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-tertiary uppercase tracking-wider">
              {t("invitationExpiry")}
            </th>
            <th className="py-2 px-3" />
          </tr>
        </thead>
        <tbody>
          {invitations.map((inv) => (
            <tr key={inv.id} className="border-b border-outline-variant/10 hover:bg-surface-container-low/30">
              <td className="py-3 px-3 text-on-surface">{inv.email}</td>
              <td className="py-3 px-3">
                <span
                  className={
                    inv.status === "PENDING"
                      ? "text-secondary font-medium"
                      : inv.status === "ACCEPTED"
                        ? "text-tertiary"
                        : "text-error/70"
                  }
                >
                  {t(`invitationStatus_${inv.status}`)}
                </span>
              </td>
              <td className="py-3 px-3 text-tertiary">
                {new Date(inv.expiresAt).toLocaleDateString()}
              </td>
              <td className="py-3 px-3 text-right">
                {inv.status === "PENDING" && (
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    disabled={revokingId === inv.id}
                    className="text-xs text-error/80 hover:text-error disabled:opacity-50 transition-colors"
                  >
                    {revokingId === inv.id ? t("revoking") : t("revoke")}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
