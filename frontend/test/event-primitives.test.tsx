import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AsyncState } from "@/components/event/async-state";
import { DataLabel } from "@/components/event/data-label";
import { EventHeader } from "@/components/event/event-header";
import { EventPanel } from "@/components/event/event-panel";
import { EventShell } from "@/components/event/event-shell";
import { ProgressRail } from "@/components/event/progress-rail";
import { SectionMarker } from "@/components/event/section-marker";
import { StatusStrip } from "@/components/event/status-strip";
import { Button } from "@/components/ui/button";

describe("event interface primitives", () => {
  it("provides semantic page and section headings", () => {
    render(
      <EventShell>
        <EventHeader eyebrow="DigiHunt 2026" title="Mission control" />
        <SectionMarker index="01" label="The challenge" />
      </EventShell>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Mission control" }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("IETE Students' Forum logo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "The challenge" }),
    ).toBeInTheDocument();
  });

  it("marks the active progress step for assistive technology", () => {
    render(
      <ProgressRail
        steps={[
          { id: "brief", label: "Brief", status: "complete" },
          { id: "solve", label: "Solve", status: "active" },
          { id: "submit", label: "Submit", status: "upcoming" },
        ]}
      />,
    );

    expect(screen.getByText("Solve").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByText("Brief").closest("li")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders status with visible text and a non-color indicator", () => {
    render(<StatusStrip status="online">Judge system online</StatusStrip>);

    expect(screen.getByText("Judge system online")).toBeVisible();
    expect(screen.getByText("●", { exact: true })).toBeInTheDocument();
  });

  it("exposes panel variants without changing panel semantics", () => {
    const { rerender } = render(
      <EventPanel aria-label="Default panel">Content</EventPanel>,
    );

    expect(screen.getByRole("region", { name: "Default panel" })).toHaveAttribute(
      "data-variant",
      "default",
    );

    rerender(
      <EventPanel aria-label="Emphasis panel" variant="emphasis">
        Content
      </EventPanel>,
    );
    expect(
      screen.getByRole("region", { name: "Emphasis panel" }),
    ).toHaveAttribute("data-variant", "emphasis");

    rerender(
      <EventPanel aria-label="Danger panel" variant="danger">
        Content
      </EventPanel>,
    );
    expect(screen.getByRole("region", { name: "Danger panel" })).toHaveAttribute(
      "data-variant",
      "danger",
    );
  });

  it("keeps button hierarchy square and keyboard focus visible", () => {
    render(
      <>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="quiet">Quiet</Button>
        <Button variant="destructive">Delete</Button>
      </>,
    );

    const primary = screen.getByRole("button", { name: "Primary" });
    const secondary = screen.getByRole("button", { name: "Secondary" });
    const quiet = screen.getByRole("button", { name: "Quiet" });

    expect(primary).toHaveClass(
      "rounded-none",
      "bg-primary",
      "focus-visible:outline-2",
      "focus-visible:outline-primary",
    );
    expect(secondary).toHaveClass("border", "bg-transparent");
    expect(quiet).toHaveClass("border-transparent", "bg-transparent");
  });

  it("composes data labels and async messaging", () => {
    render(
      <>
        <DataLabel label="Team code" value="ALPHA-7" />
        <AsyncState title="Loading missions" description="Syncing event data" />
      </>,
    );

    expect(screen.getByText("Team code")).toBeInTheDocument();
    expect(screen.getByText("ALPHA-7")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading missions");
    expect(screen.getByRole("status")).toHaveTextContent("Syncing event data");
  });
});
