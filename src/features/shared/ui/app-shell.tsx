import type { ReactNode } from "react";
import { PageBackdrop } from "./page-backdrop";
import { SiteHeader } from "./site-header";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <>
      <PageBackdrop />
      <div
        className="relative z-10 w-full mx-auto px-4 pb-16 pt-4 grid gap-4"
        style={{ maxWidth: "min(1360px, calc(100% - 2rem))", margin: "0 auto" }}
      >
        <SiteHeader />
        <main role="main" aria-live="polite" className="grid gap-4">
          {children}
        </main>
      </div>
    </>
  );
}
