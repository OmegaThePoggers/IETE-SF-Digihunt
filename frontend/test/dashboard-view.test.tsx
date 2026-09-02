import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DashboardView } from "@/features/dashboard/dashboard-view";
import {
  activeDashboardFixture,
  completedDashboardFixture,
  lockedDashboardFixture,
} from "@/features/dashboard/dashboard-fixtures";

describe("DashboardView", () => {
  it("renders locked, active, and completed rounds with semantic state labels", () => {
    render(<DashboardView model={activeDashboardFixture} onNavigate={vi.fn()} onLogout={vi.fn()} />);

    const progression = screen.getByRole("list", { name: "Mission progression" });
    expect(within(progression).getByRole("listitem", { name: /round 01.*completed/i })).toHaveAttribute(
      "data-state",
      "completed",
    );
    expect(within(progression).getByRole("listitem", { name: /round 02.*active/i })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(within(progression).getByRole("listitem", { name: /round 03.*locked/i })).toHaveAttribute(
      "data-state",
      "locked",
    );
    expect(screen.getByText("4 of 7 objectives complete")).toBeInTheDocument();
  });

  it.each([
    ["locked", lockedDashboardFixture, "Begin round 01"],
    ["active", activeDashboardFixture, "Continue round 02"],
    ["completed", completedDashboardFixture, "Review completed mission"],
  ])("offers exactly one prominent next action for the %s mission", async (_, fixture, actionLabel) => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <DashboardView model={fixture} onNavigate={onNavigate} onLogout={vi.fn()} />,
    );

    const prominentActions = container.querySelectorAll('[data-prominent-action="true"]');
    expect(prominentActions).toHaveLength(1);
    const action = screen.getByRole("button", { name: actionLabel });
    expect(action).toBe(prominentActions[0]);

    await user.click(action);
    expect(onNavigate).toHaveBeenCalledWith(fixture.currentMission.href);
  });

  it("uses a connected mission progression instead of a generic card grid", () => {
    const { container } = render(
      <DashboardView model={activeDashboardFixture} onNavigate={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(screen.getByRole("list", { name: "Mission progression" })).toHaveAttribute(
      "data-layout",
      "connected-progression",
    );
    expect(container.querySelector('[data-layout="card-grid"]')).not.toBeInTheDocument();
    expect(screen.getByText("02", { selector: '[aria-hidden="true"]' })).toHaveClass("text-primary");
  });

  it("lets participants reopen completed rounds for review", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<DashboardView model={activeDashboardFixture} onNavigate={onNavigate} onLogout={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /review round 01/i }));
    expect(onNavigate).toHaveBeenCalledWith("/round1");
  });

  it("shows numeric progress bars for Rounds 1, 2, and 3", () => {
    render(<DashboardView model={activeDashboardFixture} onNavigate={vi.fn()} onLogout={vi.fn()} />);

    expect(screen.getByRole("progressbar", { name: "Round 01 progress" })).toHaveAttribute("aria-valuenow", "3");
    expect(screen.getByRole("progressbar", { name: "Round 02 progress" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("progressbar", { name: "Round 03 progress" })).toHaveAttribute("aria-valuemax", "1");
  });

  it("keeps team code and presence secondary while exposing readable presence labels", () => {
    render(<DashboardView model={activeDashboardFixture} onNavigate={vi.fn()} onLogout={vi.fn()} />);

    expect(screen.getByText(activeDashboardFixture.team.code)).toHaveClass("font-mono-data");
    expect(screen.getByText("2 / 3 online")).toHaveClass("font-mono-data");
    expect(screen.getByText("Asha", { exact: true })).not.toHaveClass("font-mono-data");
    expect(screen.getByText("You · online")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });
});
