import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  completeRound2Fixture,
  investigatingRound2Fixture,
  lockedRound2Fixture,
  teammateClaimedRound2Fixture,
  incorrectRound2Fixture,
  loadingRound2Fixture,
} from "@/features/round2/round2-fixtures";
import { Round2View } from "@/features/round2/round2-view";

const callbacks = () => ({
  onBack: vi.fn(),
  onOpenGate: vi.fn(),
  onBackToRound1: vi.fn(),
  onEvidenceTabChange: vi.fn(),
  onClaim: vi.fn(),
  onSelect: vi.fn(),
  onSubmit: vi.fn(),
  onRelease: vi.fn(),
});

describe("Round2View", () => {
  it("renders locked and loading states", () => {
    render(<Round2View model={lockedRound2Fixture} {...callbacks()} />);
    expect(screen.getByRole("heading", { name: /round locked/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to round 1/i })).toBeInTheDocument();

    render(<Round2View model={loadingRound2Fixture} {...callbacks()} />);
    expect(screen.getByText(/loading the case file/i)).toBeInTheDocument();
  });

  it("switches evidence tabs and keeps logs scrollable in monospace", async () => {
    const user = userEvent.setup();
    const model = { ...investigatingRound2Fixture, activeEvidenceId: "log" as const };
    const cb = callbacks();
    const { rerender } = render(<Round2View model={model} {...cb} />);

    const log = screen.getByRole("region", { name: /active evidence/i });
    expect(within(log).getByText(/auth gateway accepted stale token/i)).toBeInTheDocument();
    expect(log.querySelector(".overflow-y-auto")).toBeTruthy();
    expect(log.querySelector(".font-mono-data")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: /suspicious email/i }));
    expect(cb.onEvidenceTabChange).toHaveBeenCalledWith("email");

    rerender(<Round2View model={{ ...model, activeEvidenceId: "email" }} {...cb} />);
    expect(screen.getByText(/Subject:/)).toBeInTheDocument();
  });

  it("supports question actions, incorrect feedback, and teammate claimed state", async () => {
    const user = userEvent.setup();
    const cb = callbacks();
    const { rerender } = render(<Round2View model={investigatingRound2Fixture} {...cb} />);

    await user.click(screen.getByRole("button", { name: /claim who/i }));
    expect(cb.onClaim).toHaveBeenCalledWith("q-who");

    rerender(<Round2View model={incorrectRound2Fixture} {...cb} />);
    await user.click(screen.getByRole("radio", { name: /stale token replay/i }));
    expect(cb.onSelect).toHaveBeenCalledWith("q-what", "Stale token replay");
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(cb.onSubmit).toHaveBeenCalledWith("q-what");
    await user.click(screen.getByRole("button", { name: /release/i }));
    expect(cb.onRelease).toHaveBeenCalledWith("q-what");
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();

    rerender(<Round2View model={teammateClaimedRound2Fixture} {...cb} />);
    expect(screen.getByText(/being investigated by priya/i)).toBeInTheDocument();
  });

  it("renders complete dossier summary and keyboard-accessible evidence index", async () => {
    const user = userEvent.setup();
    const cb = callbacks();
    render(<Round2View model={completeRound2Fixture} {...cb} />);

    expect(screen.getByRole("heading", { name: /complete dossier/i })).toBeInTheDocument();
    expect(screen.getByText(/WHO:/)).toBeInTheDocument();
    expect(screen.getByText(/Malicious insider/)).toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole("button", { name: /mission control/i })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: /open cipher gate/i })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("tab", { name: /server log/i })).toHaveFocus();
  });

  it("keeps completed MCQ answers visible but immutable", () => {
    render(<Round2View model={completeRound2Fixture} {...callbacks()} />);

    expect(screen.getByText(/Round 3 cipher gate is now available/i)).toBeInTheDocument();
    expect(screen.getAllByText(/✓ solved/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /claim/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^submit$/i })).not.toBeInTheDocument();
  });
});
