import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GateView } from "@/features/gate/gate-view";
import { lockedGateFixture, readyGateFixture, unlockedGateFixture } from "@/features/gate/gate-fixtures";

describe("GateView", () => {
  it("hides the key until the source round is finished", () => {
    render(<GateView model={lockedGateFixture} onChangeKey={vi.fn()} onSubmit={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText(/finish round 1/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /unscrambled key/i })).not.toBeInTheDocument();
  });

  it("shows the scrambled key and submits the unscrambled answer", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<GateView model={readyGateFixture} onChangeKey={vi.fn()} onSubmit={onSubmit} onBack={vi.fn()} />);

    expect(screen.getByText(readyGateFixture.scrambledKey!)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /unlock round 2/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("presents anagram letters with a hint and answer shape", () => {
    render(<GateView model={{ ...readyGateFixture, scrambledKey: "IPHSHIGNAPYLDAO", hint: "The bait arrived as an attachment.", wordLengths: [8, 7] }} onChangeKey={vi.fn()} onSubmit={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText("IPHSHIGNAPYLDAO")).toBeInTheDocument();
    expect(screen.getByText(/the bait arrived as an attachment/i)).toBeInTheDocument();
    expect(screen.getByText("8 · 7")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /recovered fragments/i })).not.toBeInTheDocument();
  });

  it("confirms an unlocked gate and offers the next round", () => {
    render(<GateView model={unlockedGateFixture} onChangeKey={vi.fn()} onSubmit={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText(/key accepted/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enter round 2/i })).toBeInTheDocument();
  });
});
