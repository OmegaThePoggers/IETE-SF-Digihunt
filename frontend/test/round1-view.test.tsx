import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { completeRound1Fixture, claimedRound1Fixture, availableRound1Fixture } from "@/features/round1/round1-fixtures";
import { Round1View } from "@/features/round1/round1-view";

describe("Round1View", () => {
  it("renders fixture progression and completion access key", () => {
    render(<Round1View model={completeRound1Fixture} onBack={vi.fn()} onOpen={vi.fn()} onClaim={vi.fn()} onSelect={vi.fn()} onSubmit={vi.fn()} onRelease={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /trail complete/i })).toBeInTheDocument();
    expect(screen.getByText(completeRound1Fixture.accessKey ?? "")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /clue sequence/i })).toBeInTheDocument();
  });

  it("submits the selected answer and can release ownership", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onSubmit = vi.fn();
    const onRelease = vi.fn();

    const { rerender } = render(<Round1View model={claimedRound1Fixture} onBack={vi.fn()} onOpen={vi.fn()} onClaim={vi.fn()} onSelect={onSelect} onSubmit={onSubmit} onRelease={onRelease} />);

    await user.click(screen.getByRole("radio", { name: "01001001" }));
    expect(onSelect).toHaveBeenCalledWith("01001001");

    rerender(
      <Round1View
        model={{ ...claimedRound1Fixture, selectedAnswer: "01001001" }}
        onBack={vi.fn()}
        onOpen={vi.fn()}
        onClaim={vi.fn()}
        onSelect={onSelect}
        onSubmit={onSubmit}
        onRelease={onRelease}
      />,
    );

    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /release/i }));
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("opens available clues from the sequence without claiming until the panel button is pressed", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onClaim = vi.fn();
    render(<Round1View model={{ ...availableRound1Fixture, busy: false }} onBack={vi.fn()} onOpen={onOpen} onClaim={onClaim} onSelect={vi.fn()} onSubmit={vi.fn()} onRelease={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /view clue 2/i }));
    expect(onOpen).toHaveBeenCalledWith("rq-2");
    expect(onClaim).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /claim this clue/i }));
    expect(onClaim).toHaveBeenCalledWith("rq-1");
  });

  it("lets participants switch between their claimed clues without the broken inline claim look", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<Round1View model={claimedRound1Fixture} onBack={vi.fn()} onOpen={onOpen} onClaim={vi.fn()} onSelect={vi.fn()} onSubmit={vi.fn()} onRelease={vi.fn()} />);

    expect(screen.queryByText(/^Claim$/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /open clue 1/i }));
    expect(onOpen).toHaveBeenCalledWith("rq-1");
  });
});
