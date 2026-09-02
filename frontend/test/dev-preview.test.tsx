import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PreviewToolbar } from "@/components/dev/preview-toolbar";
import {
  devPreviewsEnabled,
  resolvePreviewState,
  toDevPreviewHref,
} from "@/lib/dev-preview";

describe("development preview helpers", () => {
  it("disables previews unless the explicit value is true", () => {
    expect(devPreviewsEnabled("false")).toBe(false);
    expect(devPreviewsEnabled("")).toBe(false);
    expect(devPreviewsEnabled("TRUE")).toBe(false);
  });

  it("enables previews for the exact true value", () => {
    expect(devPreviewsEnabled("true")).toBe(true);
    expect(devPreviewsEnabled("true ")).toBe(true);
  });

  it("keeps previews disabled during production deployment", () => {
    expect(devPreviewsEnabled("true", "production")).toBe(false);
  });

  it("resolves a known state from a finite state list", () => {
    expect(resolvePreviewState("completed", ["locked", "active", "completed"] as const, "active")).toBe(
      "completed",
    );
  });

  it("falls back when the requested state is unknown or missing", () => {
    const states = ["locked", "active", "completed"] as const;
    expect(resolvePreviewState("corrupted", states, "active")).toBe("active");
    expect(resolvePreviewState(undefined, states, "active")).toBe("active");
  });

  it("remaps production navigation into unlocked synthetic preview routes", () => {
    expect(toDevPreviewHref("/dashboard")).toBe("/dev/preview/dashboard");
    expect(toDevPreviewHref("/round1")).toBe("/dev/preview/round1?state=unlocked");
    expect(toDevPreviewHref("/round2")).toBe("/dev/preview/round2?state=unlocked");
    expect(toDevPreviewHref("/round3")).toBe("/dev/preview/round3?state=active");
    expect(toDevPreviewHref("/gate/4")).toBe("/dev/preview/gate/4?state=ready");
    expect(toDevPreviewHref("/round4")).toBe("/dev/preview/round4?state=submitted");
    expect(toDevPreviewHref("/unknown")).toBe("/dev/preview");
  });
});

describe("PreviewToolbar", () => {
  it("exposes accessible route, fixture-state, and reset navigation", () => {
    const { container } = render(
      <PreviewToolbar
        activeRoute="dashboard"
        activeFixture="active"
        states={["locked", "active", "completed"]}
      />,
    );

    const toolbar = screen.getByRole("navigation", { name: /development preview/i });
    expect(toolbar).toHaveAttribute("data-preview-toolbar", "true");
    expect(container.querySelector("[data-preview-toolbar]")).toBe(toolbar);

    for (const route of ["Dashboard", "Round 1", "Round 2", "Round 3", "Cipher Gate", "Round 4"]) {
      expect(within(toolbar).getByRole("link", { name: route })).toBeInTheDocument();
    }

    expect(screen.getByText(/active fixture/i)).toBeInTheDocument();
    expect(screen.getByText("active", { selector: "strong" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("link", { name: "active" })).toHaveAttribute("aria-current", "page");
    expect(within(toolbar).getByRole("link", { name: /reset/i })).toHaveAttribute(
      "href",
      "/dev/preview/dashboard",
    );
  });
});

describe("dashboard preview source", () => {
  const source = readFileSync(resolve(process.cwd(), "app/dev/preview/dashboard/page.tsx"), "utf8");

  it("marks rendered data as a synthetic fixture", () => {
    expect(source).toContain('data-preview-fixture={state}');
    expect(source).toMatch(/synthetic fixture/i);
  });

  it("uses dashboard fixtures without importing the API module", () => {
    expect(source).toContain("dashboard-fixtures");
    expect(source).toContain("DashboardView");
    expect(source).toContain("toDevPreviewHref");
    expect(source).not.toMatch(/window\.alert/);
    expect(source).not.toMatch(/(?:@\/lib\/api|lib\/api)/);
  });
});

describe("phase preview source", () => {
  const round1 = readFileSync(resolve(process.cwd(), "app/dev/preview/round1/page.tsx"), "utf8");
  const round2 = readFileSync(resolve(process.cwd(), "app/dev/preview/round2/page.tsx"), "utf8");
  const round3 = readFileSync(resolve(process.cwd(), "app/dev/preview/round3/page.tsx"), "utf8");
  const gate = readFileSync(resolve(process.cwd(), "app/dev/preview/gate/[round]/page.tsx"), "utf8");
  const round4 = readFileSync(resolve(process.cwd(), "app/dev/preview/round4/page.tsx"), "utf8");

  it("offers an unlocked Round 1 fixture and local click-through callbacks", () => {
    expect(round1).toContain('"unlocked"');
    expect(round1).toContain("key={state}");
    expect(round1).toContain("setModel");
    expect(round1).toContain("toDevPreviewHref");
    expect(round1).not.toMatch(/(?:@\/lib\/api|lib\/api)/);
  });

  it("offers an unlocked Round 2 fixture and local click-through callbacks", () => {
    expect(round2).toContain('"unlocked"');
    expect(round2).toContain("key={state}");
    expect(round2).toContain("setModel");
    expect(round2).toContain("toDevPreviewHref");
    expect(round2).not.toMatch(/(?:@\/lib\/api|lib\/api)/);
  });

  it("keeps linked Round 3, cipher-gate, and Round 4 preview pages synthetic and clickable", () => {
    for (const source of [round3, gate, round4]) {
      expect(source).toMatch(/synthetic fixture/i);
      expect(source).toMatch(/key=\{/);
      expect(source).toContain("PreviewToolbar");
      expect(source).toContain("toDevPreviewHref");
      expect(source).not.toMatch(/(?:@\/lib\/api|lib\/api)/);
    }
  });
});
