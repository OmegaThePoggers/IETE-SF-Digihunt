"use client";

import { use, useState } from "react";
import { PreviewToolbar } from "@/components/dev/preview-toolbar";
import { completeRound2Fixture, investigatingRound2Fixture, lockedRound2Fixture } from "@/features/round2/round2-fixtures";
import { Round2View } from "@/features/round2/round2-view";
import type { Round2EvidenceId, Round2ViewModel } from "@/features/round2/round2-types";
import { devPreviewsEnabled, resolvePreviewState } from "@/lib/dev-preview";

const states = ["locked", "investigating", "complete"] as const;
const fixtures = { locked: lockedRound2Fixture, investigating: investigatingRound2Fixture, complete: completeRound2Fixture };

export default function Round2PreviewPage({ searchParams }: PageProps<"/dev/preview/round2">) {
  const params = use(searchParams);
  const state = resolvePreviewState(params.state, states, "investigating");
  const [model, setModel] = useState<Round2ViewModel>(fixtures[state]);

  if (!devPreviewsEnabled()) return <main className="p-8 font-mono-data text-sm text-muted-foreground">Dev previews are disabled.</main>;

  return <div data-preview-fixture={state} data-preview-data="synthetic fixture">
    <PreviewToolbar activeRoute="round2" activeFixture={state} states={states} />
    <Round2View
      model={model}
      onBack={() => window.alert("Synthetic fixture navigation: /dashboard")}
      onBackToRound1={() => window.alert("Synthetic fixture navigation: /round1")}
      onEvidenceTabChange={(activeEvidenceId: Round2EvidenceId) => setModel((current) => ({ ...current, activeEvidenceId }))}
      onClaim={(id) => setModel((current) => ({ ...current, state: "investigating", questions: current.questions.map((q) => q.id === id ? { ...q, status: "claimed", claimedByName: current.meName } : q) }))}
      onSelect={(id, answer) => setModel((current) => ({ ...current, questions: current.questions.map((q) => q.id === id ? { ...q, selectedAnswer: answer } : q) }))}
      onSubmit={(id) => setModel((current) => ({ ...current, state: "complete", questions: current.questions.map((q) => q.id === id ? { ...q, status: "solved", feedback: { correct: true, message: "Synthetic answer accepted." } } : q), summary: completeRound2Fixture.summary }))}
      onRelease={(id) => setModel((current) => ({ ...current, questions: current.questions.map((q) => q.id === id ? { ...q, status: "available", selectedAnswer: "", claimedByName: null } : q) }))}
    />
  </div>;
}
