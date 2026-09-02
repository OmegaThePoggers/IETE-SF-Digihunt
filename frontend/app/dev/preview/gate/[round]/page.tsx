"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PreviewToolbar } from "@/components/dev/preview-toolbar";
import { GateView } from "@/features/gate/gate-view";
import { lockedGateFixture, readyGateFixture, rejectedGateFixture, unlockedGateFixture } from "@/features/gate/gate-fixtures";
import type { GateViewModel } from "@/features/gate/gate-types";
import { resolvePreviewState, toDevPreviewHref } from "@/lib/dev-preview";

const states = ["locked", "ready", "rejected", "unlocked"] as const;
type GatePreviewState = (typeof states)[number];
const fixtures = { locked: lockedGateFixture, ready: readyGateFixture, rejected: rejectedGateFixture, unlocked: unlockedGateFixture };

type PageProps = { params: Promise<{ round: string }>; searchParams: Promise<{ state?: string }> };

export default function GatePreviewPage({ params, searchParams }: PageProps) {
  const { round } = use(params);
  const query = use(searchParams);
  const state = resolvePreviewState(query.state, states, "ready");
  return <GatePreviewSurface key={`${round}-${state}`} state={state} round={Number(round) || 2} />;
}

function GatePreviewSurface({ state, round }: { state: GatePreviewState; round: number }) {
  const router = useRouter();
  const base = fixtures[state];
  const initial = useMemo<GateViewModel>(() => ({ ...base, roundNumber: round, sourceRound: round - 1, message: base.message?.replace(/Round 2/g, `Round ${round}`) ?? null }), [base, round]);
  const [model, setModel] = useState<GateViewModel>(initial);

  return (
    <div data-preview-fixture={state} data-preview-data="synthetic fixture">
      <PreviewToolbar activeRoute="gate" activeFixture={state} states={states} />
      <GateView
        model={model}
        onChangeKey={(answer) => setModel((current) => ({ ...current, answer }))}
        onSubmit={() => setModel((current) => ({ ...current, state: "unlocked", message: `KEY ACCEPTED — Round ${round} unlocked` }))}
        onBack={() => router.push(toDevPreviewHref(round === 4 ? "/round4" : `/round${round}`))}
      />
    </div>
  );
}
