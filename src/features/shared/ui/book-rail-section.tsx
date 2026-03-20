"use client";

import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { EmptyState } from "../components/empty-state";

interface BookRailSectionProps {
  title: string;
  eyebrow?: string;
  count?: number;
  emptyTitle?: string;
  emptyCopy?: string;
  children: ReactNode;
  className?: string;
}

export function BookRailSection({
  title,
  eyebrow,
  count,
  emptyTitle = "Nothing here yet",
  emptyCopy = "Add some books to get started.",
  children,
  className,
}: BookRailSectionProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [hasOverflowStart, setHasOverflowStart] = useState(false);
  const [hasOverflowEnd, setHasOverflowEnd] = useState(true);

  const hasChildren =
    Array.isArray(children) ? children.length > 0 : Boolean(children);

  function handleScroll() {
    const el = railRef.current;
    if (!el) return;
    setHasOverflowStart(el.scrollLeft > 8);
    setHasOverflowEnd(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }

  return (
    <section className={cn("space-y-6", className)}>
      {/* Section heading */}
      <div className="flex items-center justify-between">
        <div className="grid gap-0.5">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-widest text-tertiary">
              {eyebrow}
            </p>
          )}
          <h2 className="text-2xl font-bold tracking-tight text-on-surface">
            {title}
          </h2>
        </div>
        {count !== undefined && (
          <span className="text-sm text-tertiary tabular-nums shrink-0">
            {count} {count === 1 ? "book" : "books"}
          </span>
        )}
      </div>

      {/* Rail or empty state */}
      {hasChildren ? (
        <div className="relative">
          {/* Left fade edge */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none transition-opacity duration-200 bg-gradient-to-r from-surface to-transparent",
              hasOverflowStart ? "opacity-100" : "opacity-0",
            )}
            aria-hidden="true"
          />
          {/* Right fade edge */}
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none transition-opacity duration-200 bg-gradient-to-l from-surface to-transparent",
              hasOverflowEnd ? "opacity-100" : "opacity-0",
            )}
            aria-hidden="true"
          />

          {/* Scrollable rail */}
          <div
            ref={railRef}
            onScroll={handleScroll}
            className="flex gap-6 overflow-x-auto hide-scrollbar pb-4"
            style={{ scrollbarWidth: "none" }}
          >
            {children}
          </div>
        </div>
      ) : (
        <EmptyState title={emptyTitle} description={emptyCopy} />
      )}
    </section>
  );
}
