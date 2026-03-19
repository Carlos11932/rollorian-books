import Link from "next/link";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header
      className="flex justify-between gap-4 items-start px-[clamp(1.2rem,2.8vw,2rem)] py-[clamp(1rem,2vw,1.4rem)] rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] backdrop-blur-[16px] shadow-[var(--shadow-default)]"
      style={{ backdropFilter: "blur(16px)" }}
    >
      {/* Brand */}
      <div className="grid gap-3 max-w-[42rem]">
        <Link
          href="/"
          className="inline-flex gap-3 items-center group focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm"
          aria-label="Rollorian — Home"
        >
          <span
            className="grid place-items-center w-[3.35rem] h-[3.35rem] rounded-[1rem] text-white text-[1.6rem] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
            style={{
              fontFamily: "var(--font-display)",
              background: "linear-gradient(160deg, var(--color-accent) 0%, var(--color-accent-strong) 100%)",
            }}
            aria-hidden="true"
          >
            R
          </span>
          <span>
            <span className="block text-[0.7rem] font-bold uppercase tracking-widest text-muted">
              Rollorian Archive
            </span>
            <strong className="block text-[1.45rem] text-text leading-tight">
              Book Archive
            </strong>
          </span>
        </Link>
        <p className="text-sm text-muted leading-relaxed hidden md:block">
          A personal screening room for your reading life. Search globally,
          curate locally.
        </p>
      </div>

      {/* Navigation */}
      <NavLinks />
    </header>
  );
}
