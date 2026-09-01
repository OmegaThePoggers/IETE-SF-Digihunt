import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionMarker } from "@/components/event/section-marker";

describe("SectionMarker", () => {
  it("renders its index and label", () => {
    render(<SectionMarker index="01" label="The challenge" />);

    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("The challenge")).toBeInTheDocument();
  });
});
