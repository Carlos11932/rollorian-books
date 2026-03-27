"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import Image from "next/image";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "USER" | "SUPERADMIN";
  bookCount: number;
}

interface UserListProps {
  users: AdminUser[];
  currentUserId: string;
}

export function UserList({ users, currentUserId }: UserListProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setDeleteError(data.error ?? "Failed to delete user.");
      }
    } finally {
      setDeletingId(null);
    }
  }

  if (users.length === 0) {
    return <p className="text-sm text-tertiary py-4">{t("noUsers")}</p>;
  }

  return (
    <div className="grid gap-3">
      {deleteError != null && (
        <p
          role="alert"
          className="text-sm text-error px-4 py-3 rounded-xl border border-error/30 bg-error/10"
        >
          {deleteError}
        </p>
      )}
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-outline-variant/20">
            <th className="text-left py-2 px-3 text-xs font-semibold text-tertiary uppercase tracking-wider">
              {t("userColName")}
            </th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-tertiary uppercase tracking-wider">
              {t("userColEmail")}
            </th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-tertiary uppercase tracking-wider">
              {t("userColRole")}
            </th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-tertiary uppercase tracking-wider">
              {t("userColBooks")}
            </th>
            <th className="py-2 px-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const isSuperAdmin = user.role === "SUPERADMIN";
            return (
              <tr
                key={user.id}
                className="border-b border-outline-variant/10 hover:bg-surface-container-low/30"
              >
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name ?? user.email}
                        width={28}
                        height={28}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary-container flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">
                          {(user.name?.[0] ?? user.email[0] ?? "U").toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-on-surface">{user.name ?? "—"}</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-tertiary">{user.email}</td>
                <td className="py-3 px-3">
                  <span className={isSuperAdmin ? "text-primary font-medium" : "text-tertiary"}>
                    {isSuperAdmin ? t("roleSuperadmin") : t("roleUser")}
                  </span>
                </td>
                <td className="py-3 px-3 text-tertiary text-center">{user.bookCount}</td>
                <td className="py-3 px-3 text-right">
                  {!isSuperAdmin && !isSelf && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={deletingId === user.id}
                      className="text-xs text-error/80 hover:text-error disabled:opacity-50 transition-colors"
                    >
                      {deletingId === user.id ? t("deleting") : t("deleteUser")}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}
