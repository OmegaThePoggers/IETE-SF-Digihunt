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

const states = ["locked", "ready", "failure", "success"] as const;

type MasterPreviewState = (typeof states)[number];

const messages: Record<MasterPreviewState, { title: string; status: "neutral" | "error" | "online"; message: string }> = {
  locked: {
    title: "Terminal locked",
    status: "neutral",
    message: "Synthetic lock state. Use the toolbar to jump to ready without backend progression.",
  },
  ready: {
    title: "Terminal armed",
    status: "neutral",
    message: "All controls are available in this synthetic preview.",
  },
  failure: {
    title: "Verification failed",
    status: "error",
    message: "ACCESS DENIED — synthetic failure state.",
  },
  success: {
    title: "Gate authorized",
    status: "online",
    message: "ACCESS GRANTED — synthetic Round 3 handoff ready.",
  },
};

export default function MasterPreviewPage({ searchParams }: PageProps<"/dev/preview/master">) {
  const params = use(searchParams);
  const state = resolvePreviewState(params.state, states, "ready");

  return <MasterPreviewSurface key={state} state={state} />;
}

function MasterPreviewSurface({ state }: { state: MasterPreviewState }) {
  const router = useRouter();
  const [localState, setLocalState] = useState<MasterPreviewState>(state);
  const [code, setCode] = useState("PREVIEW-UNLOCKED-KEY");
  const current = messages[localState];

  return (
    <div data-preview-fixture={state} data-preview-data="synthetic fixture">
      <PreviewToolbar activeRoute="master" activeFixture={state} states={states} />
      <EventShell>
        <EventHeader
          eyebrow="Master Terminal // Synthetic"
          title={current.title}
          description="Click through verification states without auth, API calls, database state, or production bypasses."
          actions={
            <Button variant="outline" onClick={() => { router.push(toDevPreviewHref("/dashboard")); }}>
              Mission control
            </Button>
          }
        />
        <div className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <EventPanel variant={localState === "success" ? "emphasis" : localState === "failure" ? "danger" : "default"}>
            <p className="font-mono-data mb-4 text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Synthetic verification surface
            </p>
            <label className="block">
              <span className="font-mono-data text-xs tracking-[0.16em] text-secondary uppercase">Master code</span>
              <input
                className="font-mono-data mt-3 w-full border border-border bg-input px-4 py-3 text-lg text-foreground outline-none focus-visible:border-primary"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => setLocalState("success")}>Verify synthetic code</Button>
              <Button variant="outline" onClick={() => setLocalState("failure")}>Show failure</Button>
              <Button variant="quiet" onClick={() => { router.push(toDevPreviewHref("/round3")); }}>
                Continue to Round 3
              </Button>
            </div>
          </EventPanel>
          <EventPanel variant="muted">
            <StatusStrip status={current.status}>{current.message}</StatusStrip>
            <p className="mt-5 text-sm leading-6 text-muted-foreground">
              This page is only reachable through the dev preview layout when the explicit preview flag is enabled.
            </p>
          </EventPanel>
        </div>
      </EventShell>
    </div>
  );
}
