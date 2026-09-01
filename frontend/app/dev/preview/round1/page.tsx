"use client";

import { use, useState } from "react";

import { PreviewToolbar } from "@/components/dev/preview-toolbar";
import {
  availableRound1Fixture,
  claimedRound1Fixture,
  completeRound1Fixture,
  incorrectRound1Fixture,
} from "@/features/round1/round1-fixtures";
import { Round1View } from "@/features/round1/round1-view";
import type { Round1ViewModel } from "@/features/round1/round1-types";
import { devPreviewsEnabled, resolvePreviewState } from "@/lib/dev-preview";

const states = ["available", "claimed", "incorrect", "complete"] as const;
const fixtures = {
  available: availableRound1Fixture,
  claimed: claimedRound1Fixture,
  incorrect: incorrectRound1Fixture,
  complete: completeRound1Fixture,
};

export default function Round1PreviewPage({ searchParams }: PageProps<"/dev/preview/round1">) {
  const params = use(searchParams);
  const state = resolvePreviewState(params.state, states, "claimed");
  const [model, setModel] = useState<Round1ViewModel>(fixtures[state]);

  if (!devPreviewsEnabled()) {
    return <main className="p-8 font-mono-data text-sm text-muted-foreground">Dev previews are disabled.</main>;
  }

  return (
    <div data-preview-fixture={state} data-preview-data="synthetic fixture">
      <PreviewToolbar activeRoute="round1" activeFixture={state} states={states} />
      <Round1View
        model={model}
        onBack={() => window.alert("Synthetic fixture navigation: /dashboard")}
        onSelect={(answer) => setModel((current) => ({ ...current, selectedAnswer: answer }))}
        onSubmit={() => setModel((current) => ({
          ...current,
          state: "incorrect",
          feedback: { tone: "error", message: "ACCESS DENIED — Synthetic callback captured." },
        }))}
        onRelease={() => setModel((current) => ({
          ...current,
          state: "available",
          selectedAnswer: "",
          feedback: { tone: "neutral", message: "Synthetic release callback captured." },
        }))}
      />
    </div>
  );
}
