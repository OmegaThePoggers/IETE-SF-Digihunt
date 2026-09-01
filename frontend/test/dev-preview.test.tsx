import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PreviewToolbar } from "@/components/dev/preview-toolbar";
import {
  devPreviewsEnabled,
  resolvePreviewState,
} from "@/lib/dev-preview";

describe("development preview helpers", () => {
  it("disables previews unless the explicit value is true", () => {
    expect(devPreviewsEnabled("false")).toBe(false);
    expect(devPreviewsEnabled("")).toBe(false);
    expect(devPreviewsEnabled("TRUE")).toBe(false);
  });

  it("enables previews for the exact true value", () => {
    expect(devPreviewsEnabled("true")).toBe(true);
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

    for (const route of ["Dashboard", "Round 1", "Round 2", "Master", "Round 3"]) {
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
    expect(source).not.toMatch(/(?:@\/lib\/api|lib\/api)/);
  });
});
