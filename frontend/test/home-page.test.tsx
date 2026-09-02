import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/boot-sequence", () => ({
  BootSequence: () => null,
}));

import Home from "@/app/page";

describe("Home", () => {
  it("provides a visible login link for returning participants", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login");
  });
});
