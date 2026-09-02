"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";

import { PreviewToolbar } from "@/components/dev/preview-toolbar";
import {
  availableRound1Fixture,
  claimedRound1Fixture,
  completeRound1Fixture,
  incorrectRound1Fixture,
} from "@/features/round1/round1-fixtures";
import { Round1View } from "@/features/round1/round1-view";
import type { Round1ViewModel } from "@/features/round1/round1-types";
import { resolvePreviewState, toDevPreviewHref } from "@/lib/dev-preview";

const states = ["unlocked", "available", "claimed", "incorrect", "complete"] as const;
type Round1PreviewState = (typeof states)[number];

const fixtures = {
  unlocked: claimedRound1Fixture,
  available: availableRound1Fixture,
  claimed: claimedRound1Fixture,
  incorrect: incorrectRound1Fixture,
  complete: completeRound1Fixture,
};

function solveCurrentClue(current: Round1ViewModel): Round1ViewModel {
  const nextClues = current.clues.map((clue, index) =>
    index === current.currentIndex
      ? {
          ...clue,
          status: "solved" as const,
          claimedByName: current.meName,
          codeFragment: clue.codeFragment ?? `PX${index + 1}`,
        }
      : clue,
  );
  const nextIndex = nextClues.findIndex((clue) => clue.status !== "solved");

  if (nextIndex === -1) {
    return {
      ...current,
      state: "complete",
      clues: nextClues,
      currentIndex: nextClues.length,
      selectedAnswer: "",
      nextGateRound: 2,
      feedback: { tone: "success", message: "ACCESS GRANTED — synthetic trail complete." },
      busy: false,
    };
  }

  return {
    ...current,
    state: "answering",
    clues: nextClues.map((clue, index) =>
      index === nextIndex ? { ...clue, status: "claimed" as const, claimedByName: current.meName } : clue,
    ),
    currentIndex: nextIndex,
    selectedAnswer: "",
    feedback: { tone: "success", message: "Synthetic answer accepted. Next clue auto-unlocked." },
    busy: false,
  };
}

export default function Round1PreviewPage({ searchParams }: PageProps<"/dev/preview/round1">) {
  const params = use(searchParams);
  const state = resolvePreviewState(params.state, states, "unlocked");

  return <Round1PreviewSurface key={state} state={state} />;
}

function Round1PreviewSurface({ state }: { state: Round1PreviewState }) {
  const router = useRouter();
  const [model, setModel] = useState<Round1ViewModel>(fixtures[state]);

  return (
    <div data-preview-fixture={state} data-preview-data="synthetic fixture">
      <PreviewToolbar activeRoute="round1" activeFixture={state} states={states} />
      <Round1View
        model={model}
        onBack={() => {
          router.push(toDevPreviewHref("/dashboard"));
        }}
        onOpenGate={() => {
          router.push(toDevPreviewHref("/gate/2"));
        }}
        onOpen={(id) => setModel((current) => {
          const currentIndex = current.clues.findIndex((clue) => clue.id === id);
          return currentIndex >= 0
            ? { ...current, currentIndex, selectedAnswer: "", feedback: null }
            : current;
        })}
        onClaim={(id) => setModel((current) => {
          const currentIndex = current.clues.findIndex((clue) => clue.id === id);
          return {
            ...current,
            state: "answering",
            currentIndex,
            clues: current.clues.map((clue) => clue.id === id
              ? { ...clue, status: "claimed" as const, claimedByName: current.meName }
              : clue),
            selectedAnswer: "",
            feedback: { tone: "neutral", message: "Synthetic clue claimed." },
          };
        })}
        onSelect={(answer) => setModel((current) => ({ ...current, selectedAnswer: answer }))}
        onSubmit={() => setModel((current) => solveCurrentClue(current))}
        onRelease={() => setModel((current) => ({
          ...current,
          state: "available",
          clues: current.clues.map((clue, index) =>
            index === current.currentIndex
              ? { ...clue, status: "available" as const, claimedByName: null }
              : clue,
          ),
          selectedAnswer: "",
          feedback: { tone: "neutral", message: "Synthetic clue released." },
          busy: false,
        }))}
      />
    </div>
  );
}
