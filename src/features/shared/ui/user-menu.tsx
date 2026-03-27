"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/lib/types/user";

interface UserMenuUser {
  name: string | null;
  email: string;
  image: string | null;
}

interface UserMenuProps {
  user: UserMenuUser;
  signOutAction: () => Promise<void>;
  role?: UserRole;
}

export function UserMenu({ user, signOutAction, role }: UserMenuProps) {
  const [open, setOpen] = useState(false);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user.email[0] ?? "U").toUpperCase();

  return (
    <div className="relative">
      {/* Avatar trigger */}
      <button
        type="button"
        aria-label="Open user menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="w-8 h-8 rounded-full overflow-hidden border border-primary/20 bg-surface-container flex items-center justify-center hover:border-primary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name ?? user.email}
            width={32}
            height={32}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs font-bold text-primary leading-none">
            {initials}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />

          <div
            role="menu"
            className={cn(
              "absolute right-0 top-10 z-50 min-w-[200px]",
              "bg-surface-container border border-outline-variant/20 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.4)]",
              "p-1"
            )}
          >
            {/* User info header */}
            <div className="px-3 py-2 mb-1">
              <p className="text-sm font-medium text-on-surface truncate">
                {user.name ?? "—"}
              </p>
              <p className="text-xs text-tertiary truncate">{user.email}</p>
            </div>

            <div className="border-t border-outline-variant/20 my-1" />

            {/* Admin link — only for SUPERADMIN */}
            {role === "SUPERADMIN" && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-tertiary hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                Admin
              </Link>
            )}

            {/* Sign out */}
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-tertiary hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors text-left"
                onClick={() => setOpen(false)}
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
