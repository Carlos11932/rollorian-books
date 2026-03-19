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
    <section
      className={cn(
        "rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] backdrop-blur-[16px] p-6 grid gap-4",
        className,
      )}
      style={{ backdropFilter: "blur(16px)" }}
    >
      {/* Section heading */}
      <header className="flex items-end justify-between gap-4">
        <div className="grid gap-0.5">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              {eyebrow}
            </p>
          )}
          <h2 className="text-2xl font-bold text-text" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </h2>
        </div>
        {count !== undefined && (
          <span className="text-sm text-muted tabular-nums shrink-0">
            {count} {count === 1 ? "book" : "books"}
          </span>
        )}
      </header>

      {/* Rail or empty state */}
      {hasChildren ? (
        <div className="relative">
          {/* Left fade edge */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none transition-opacity duration-200 bg-gradient-to-r from-[rgba(8,12,20,0.9)] to-transparent",
              hasOverflowStart ? "opacity-100" : "opacity-0",
            )}
            aria-hidden="true"
          />
          {/* Right fade edge */}
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none transition-opacity duration-200 bg-gradient-to-l from-[rgba(8,12,20,0.9)] to-transparent",
              hasOverflowEnd ? "opacity-100" : "opacity-0",
            )}
            aria-hidden="true"
          />

          {/* Scrollable rail */}
          <div
            ref={railRef}
            onScroll={handleScroll}
            className="flex gap-4 overflow-x-auto scroll-smooth pb-2"
            style={{
              scrollSnapType: "x mandatory",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
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
