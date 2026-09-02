import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Round3View } from "@/features/round3/round3-view";
import { activeRound3Fixture, completeRound3Fixture } from "@/features/round3/round3-fixtures";

describe("Round3View", () => {
  it("renders the defensive-prototyping brief and the question list", () => {
    render(<Round3View model={activeRound3Fixture} onClaim={vi.fn()} onSelect={vi.fn()} onSubmit={vi.fn()} onRelease={vi.fn()} onBack={vi.fn()} onBackToRound2={vi.fn()} onOpenGate={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/final hack/i);
    expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
  });

  it("points at the round 4 gate once every question is solved", () => {
    render(<Round3View model={completeRound3Fixture} onClaim={vi.fn()} onSelect={vi.fn()} onSubmit={vi.fn()} onRelease={vi.fn()} onBack={vi.fn()} onBackToRound2={vi.fn()} onOpenGate={vi.fn()} />);

    expect(screen.getByRole("button", { name: /cipher gate/i })).toBeInTheDocument();
  });
});
