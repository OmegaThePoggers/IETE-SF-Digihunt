import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("event theme", () => {
  it("defines the authoritative event color roles", () => {
    expect(css).toContain("--event-black: #06080a");
    expect(css).toContain("--event-surface: #0d110f");
    expect(css).toContain("--event-surface-strong: #141a16");
    expect(css).toContain("--event-white: #f3f4ee");
    expect(css).toContain("--event-gray: #c3c7be");
    expect(css).toContain("--event-muted: #787e75");
    expect(css).toContain("--event-border-faint: rgba(243, 244, 238, 0.06)");
    expect(css).toContain("--event-border: rgba(243, 244, 238, 0.12)");
    expect(css).toContain("--event-border-strong: rgba(200, 255, 0, 0.42)");
    expect(css).toContain("--event-lime: #c8ff00");
  });

  it("maps the shadcn theme to event roles with square geometry", () => {
    expect(css).toContain("--background: var(--event-black)");
    expect(css).toContain("--foreground: var(--event-white)");
    expect(css).toContain("--card: var(--event-surface)");
    expect(css).toContain("--primary: var(--event-lime)");
    expect(css).toContain("--border: var(--event-border)");
    expect(css).toContain("--radius: 0rem");
  });

  it("provides visible keyboard focus and reduced-motion behavior", () => {
    expect(css).toMatch(/:focus-visible\s*\{/);
    expect(css).toContain("outline: 2px solid var(--event-lime)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 0.01ms !important");
    expect(css).toContain("scroll-behavior: auto !important");
  });
});
