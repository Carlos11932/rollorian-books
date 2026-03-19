"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/library", label: "Library" },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-3 flex-wrap justify-end" aria-label="Primary">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-2.5 text-sm font-bold transition-all duration-200",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
              isActive
                ? "bg-gradient-to-br from-accent to-accent-strong border-transparent text-white"
                : "border-white/22 bg-white/6 text-muted hover:text-text hover:-translate-y-px",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
