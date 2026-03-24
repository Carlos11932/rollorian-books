import { describe, it, expect } from "vitest";
import { stripHtml } from "@/lib/utils/text";

describe("stripHtml", () => {
  it("returns empty string for null input", () => {
    expect(stripHtml(null)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(stripHtml(undefined)).toBe("");
  });

  it("returns empty string for an empty string", () => {
    expect(stripHtml("")).toBe("");
  });

  it("returns the same string when there is no HTML", () => {
    expect(stripHtml("Hello world")).toBe("Hello world");
  });

  it("removes a simple HTML tag", () => {
    expect(stripHtml("<p>Hello</p>")).toBe("Hello");
  });

  it("removes nested HTML tags", () => {
    expect(stripHtml("<div><p><strong>Bold text</strong></p></div>")).toBe("Bold text");
  });

  it("removes self-closing tags", () => {
    expect(stripHtml("Line one<br/>Line two")).toBe("Line one Line two");
  });

  it("decodes &nbsp; to a space", () => {
    expect(stripHtml("Hello&nbsp;World")).toBe("Hello World");
  });

  it("decodes &amp; to &", () => {
    expect(stripHtml("Tom &amp; Jerry")).toBe("Tom & Jerry");
  });

  it("decodes &lt; to <", () => {
    expect(stripHtml("a &lt; b")).toBe("a < b");
  });

  it("decodes &gt; to >", () => {
    expect(stripHtml("a &gt; b")).toBe("a > b");
  });

  it("decodes &quot; to a double quote", () => {
    expect(stripHtml("Say &quot;hello&quot;")).toBe('Say "hello"');
  });

  it("decodes &#39; to a single quote", () => {
    expect(stripHtml("It&#39;s fine")).toBe("It's fine");
  });

  it("collapses multiple spaces into one", () => {
    expect(stripHtml("Hello    World")).toBe("Hello World");
  });

  it("trims leading and trailing whitespace", () => {
    expect(stripHtml("  Hello World  ")).toBe("Hello World");
  });

  it("handles a realistic Google Books description snippet", () => {
    const input = "<p>A <b>classic</b> guide to writing clean code.</p><br/>Recommended for all developers.";
    const output = stripHtml(input);
    expect(output).toBe("A classic guide to writing clean code. Recommended for all developers.");
  });
});
