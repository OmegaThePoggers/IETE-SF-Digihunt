"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";

import { PreviewToolbar } from "@/components/dev/preview-toolbar";
import { EventHeader } from "@/components/event/event-header";
import { EventPanel } from "@/components/event/event-panel";
import { EventShell } from "@/components/event/event-shell";
import { StatusStrip } from "@/components/event/status-strip";
import { Button } from "@/components/ui/button";
import { resolvePreviewState, toDevPreviewHref } from "@/lib/dev-preview";

const states = ["locked", "empty", "uploading", "submitted", "error"] as const;
type Round3PreviewState = (typeof states)[number];

export default function Round4PreviewPage({ searchParams }: PageProps<"/dev/preview/round3">) {
  const params = use(searchParams);
  const state = resolvePreviewState(params.state, states, "submitted");

  return <Round4PreviewSurface key={state} state={state} />;
}

function Round4PreviewSurface({ state }: { state: Round3PreviewState }) {
  const router = useRouter();
  const [localState, setLocalState] = useState<Round3PreviewState>(state);
  const [fileName, setFileName] = useState("null-pointers-final-brief.pptx");

  const status = localState === "error" ? "error" : localState === "submitted" ? "online" : "neutral";
  const statusMessage =
    localState === "locked"
      ? "Synthetic locked state. Use toolbar or controls to unlock for UI testing."
      : localState === "uploading"
        ? "Synthetic upload in progress. No file leaves your browser."
        : localState === "submitted"
          ? `Synthetic submission ready: ${fileName}`
          : localState === "error"
            ? "UPLOAD FAILED — synthetic error state."
            : "No synthetic submission yet.";

  return (
    <div data-preview-fixture={state} data-preview-data="synthetic fixture">
      <PreviewToolbar activeRoute="round4" activeFixture={state} states={states} />
      <EventShell>
        <EventHeader
          eyebrow="Round 4 // Synthetic workshop"
          title="Final hack submission"
          description="Exercise upload, replacement, history, error, and navigation states without authentication or API calls."
          actions={
            <Button variant="outline" onClick={() => { router.push(toDevPreviewHref("/dashboard")); }}>
              Mission control
            </Button>
          }
        />

        <div className="grid gap-8 py-10 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <EventPanel variant="muted">
            <p className="font-mono-data mb-4 text-xs tracking-[0.18em] text-muted-foreground uppercase">Case brief</p>
            <h2 className="text-2xl font-bold uppercase">Phishing response prototype</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
              <li>Problem: stolen credentials reached the admin panel.</li>
              <li>Build: a detection or awareness prototype.</li>
              <li>Submit: a PPTX explaining evidence, solution, impact, and next steps.</li>
            </ul>
          </EventPanel>

          <EventPanel variant={localState === "error" ? "danger" : localState === "submitted" ? "emphasis" : "default"}>
            <StatusStrip status={status}>{statusMessage}</StatusStrip>
            <label className="mt-6 block">
              <span className="font-mono-data text-xs tracking-[0.16em] text-secondary uppercase">Synthetic file name</span>
              <input
                className="font-mono-data mt-3 w-full border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus-visible:border-primary"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
              />
            </label>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => setLocalState("submitted")}>Simulate upload success</Button>
              <Button variant="outline" onClick={() => setLocalState("uploading")}>Show uploading</Button>
              <Button variant="destructive" onClick={() => setLocalState("error")}>Show upload error</Button>
              <Button variant="quiet" onClick={() => { router.push(toDevPreviewHref("/gate/4")); }}>
                Back to Master
              </Button>
            </div>
            <div className="mt-8 border-t border-border pt-5">
              <p className="font-mono-data text-xs tracking-[0.16em] text-muted-foreground uppercase">Synthetic history</p>
              <p className="mt-3 text-sm text-secondary">v2 {fileName}</p>
              <p className="text-sm text-muted-foreground">v1 early-wireframe-brief.pptx</p>
            </div>
          </EventPanel>
        </div>
      </EventShell>
    </div>
  );
}
