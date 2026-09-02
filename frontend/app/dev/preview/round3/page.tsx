"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { PreviewToolbar } from "@/components/dev/preview-toolbar";
import { activeRound3Fixture, completeRound3Fixture, lockedRound3Fixture } from "@/features/round3/round3-fixtures";
import { Round3View } from "@/features/round3/round3-view";
import type { Round3ViewModel } from "@/features/round3/round3-types";
import { resolvePreviewState, toDevPreviewHref } from "@/lib/dev-preview";

const states = ["locked", "active", "complete"] as const;
type Round3PreviewState = (typeof states)[number];
const fixtures = { locked: lockedRound3Fixture, active: activeRound3Fixture, complete: completeRound3Fixture };

export default function Round3PreviewPage({ searchParams }: PageProps<"/dev/preview/round3">) {
  const params = use(searchParams);
  const state = resolvePreviewState(params.state, states, "active");
  return <Round3PreviewSurface key={state} state={state} />;
}

function Round3PreviewSurface({ state }: { state: Round3PreviewState }) {
  const router = useRouter();
  const [model, setModel] = useState<Round3ViewModel>(fixtures[state]);
  return <div data-preview-fixture={state} data-preview-data="synthetic fixture">
    <PreviewToolbar activeRoute="round3" activeFixture={state} states={states} />
    <Round3View
      model={model}
      onBack={() => router.push(toDevPreviewHref("/dashboard"))}
      onBackToRound2={() => router.push(toDevPreviewHref("/round2"))}
      onOpenGate={() => router.push(toDevPreviewHref("/gate/4"))}
      onClaim={(id) => setModel((current) => ({ ...current, state: "solving", questions: current.questions.map((q) => q.id === id ? { ...q, status: "claimed", claimedByName: current.meName } : q) }))}
      onSelect={(id, selectedAnswer) => setModel((current) => ({ ...current, questions: current.questions.map((q) => q.id === id ? { ...q, selectedAnswer } : q) }))}
      onSubmit={(id) => setModel((current) => ({ ...current, questions: current.questions.map((q) => q.id === id ? { ...q, status: "solved", codeFragment: q.codeFragment ?? "PX3", feedback: { correct: true, message: "Synthetic answer accepted." } } : q) }))}
      onRelease={(id) => setModel((current) => ({ ...current, questions: current.questions.map((q) => q.id === id ? { ...q, status: "available", claimedByName: null } : q) }))}
    />
  </div>;
}
