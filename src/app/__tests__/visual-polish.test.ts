import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

describe("visual polish rescue from PR 14", () => {
  it("defines the semantic theme aliases and missing radius tokens in globals.css", () => {
    const globalsCss = readSource("src", "app", "globals.css");

    expect(globalsCss).toContain("--color-text: var(--color-on-surface);");
    expect(globalsCss).toContain("--color-muted: var(--color-on-surface-variant);");
    expect(globalsCss).toContain("--color-line: var(--color-outline-variant);");
    expect(globalsCss).toContain("--color-accent: var(--color-primary);");
    expect(globalsCss).toContain("--color-accent-strong: var(--color-primary-fixed);");
    expect(globalsCss).toContain("--color-surface-soft: var(--color-surface-container);");
    expect(globalsCss).toContain("--color-surface-strong: var(--color-surface-container-high);");
    expect(globalsCss).toContain("--radius-sm: var(--radius);");
    expect(globalsCss).toContain("--radius-md: var(--radius-lg);");
  });

  it("loads Material Symbols from the root layout instead of globals.css", () => {
    const globalsCss = readSource("src", "app", "globals.css");
    const layout = readSource("src", "app", "layout.tsx");

    expect(globalsCss).not.toContain("Material+Symbols+Outlined");
    expect(layout).toContain("rel=\"preconnect\"");
    expect(layout).toContain("fonts.googleapis.com");
    expect(layout).toContain("fonts.gstatic.com");
    expect(layout).toContain("display=swap");
  });

  it("keeps the header search button and page gutters visually consistent", () => {
    const siteHeader = readSource("src", "features", "shared", "ui", "site-header.tsx");
    const libraryPage = readSource("src", "app", "library", "page.tsx");
    const libraryLoading = readSource("src", "app", "library", "loading.tsx");
    const searchPage = readSource("src", "app", "search", "page.tsx");
    const searchLoading = readSource("src", "app", "search", "loading.tsx");

    expect(siteHeader).toContain('className="hover:bg-surface-variant/50 p-2 rounded-full transition-colors"');
    expect(siteHeader).toContain('className="material-symbols-outlined text-primary"');
    expect(siteHeader).not.toContain('className="material-symbols-outlined text-primary hover:bg-surface-variant/50 p-2 rounded-full transition-colors"');

    expect(libraryPage).toContain('className="grid gap-6 px-12 md:px-20 pt-8 pb-24"');
    expect(libraryLoading).toContain('className="grid gap-6 px-12 md:px-20 pt-8 pb-24"');
    expect(searchPage).toContain('className="pt-8 px-12 md:px-20 pb-24"');
    expect(searchPage).not.toContain('<main className="lg:ml-64 pt-24 px-6 md:px-12 pb-24">');
    expect(searchLoading).toContain('className="grid gap-6 px-12 md:px-20 pt-8 pb-24"');
  });
});
