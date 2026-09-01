"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";

import { PreviewToolbar } from "@/components/dev/preview-toolbar";
import {
  completeRound2Fixture,
  investigatingRound2Fixture,
  lockedRound2Fixture,
} from "@/features/round2/round2-fixtures";
import { Round2View } from "@/features/round2/round2-view";
import type { Round2EvidenceId, Round2ViewModel } from "@/features/round2/round2-types";
import { resolvePreviewState, toDevPreviewHref } from "@/lib/dev-preview";

const states = ["unlocked", "locked", "investigating", "complete"] as const;
type Round2PreviewState = (typeof states)[number];

const fixtures = {
  unlocked: investigatingRound2Fixture,
  locked: lockedRound2Fixture,
  investigating: investigatingRound2Fixture,
  complete: completeRound2Fixture,
};

function solveQuestion(current: Round2ViewModel, id: string): Round2ViewModel {
  const questions = current.questions.map((q) =>
    q.id === id
      ? {
          ...q,
          status: "solved" as const,
          claimedByName: current.meName,
          feedback: { correct: true, message: "Synthetic answer accepted." },
        }
      : q,
  );
  const allSolved = questions.every((q) => q.status === "solved");

  return {
    ...current,
    state: allSolved ? "complete" : "investigating",
    questions,
    summary: allSolved ? completeRound2Fixture.summary : current.summary,
  };
}

export default function Round2PreviewPage({ searchParams }: PageProps<"/dev/preview/round2">) {
  const params = use(searchParams);
  const state = resolvePreviewState(params.state, states, "unlocked");

  return <Round2PreviewSurface key={state} state={state} />;
}

function Round2PreviewSurface({ state }: { state: Round2PreviewState }) {
  const router = useRouter();
  const [model, setModel] = useState<Round2ViewModel>(fixtures[state]);

  return (
    <div data-preview-fixture={state} data-preview-data="synthetic fixture">
      <PreviewToolbar activeRoute="round2" activeFixture={state} states={states} />
      <Round2View
        model={model}
        onBack={() => {
          router.push(toDevPreviewHref("/dashboard"));
        }}
        onBackToRound1={() => {
          router.push(toDevPreviewHref("/round1"));
        }}
        onEvidenceTabChange={(activeEvidenceId: Round2EvidenceId) =>
          setModel((current) => ({ ...current, activeEvidenceId }))
        }
        onClaim={(id) =>
          setModel((current) => ({
            ...current,
            state: "investigating",
            questions: current.questions.map((q) =>
              q.id === id ? { ...q, status: "claimed" as const, claimedByName: current.meName } : q,
            ),
          }))
        }
        onSelect={(id, answer) =>
          setModel((current) => ({
            ...current,
            questions: current.questions.map((q) =>
              q.id === id ? { ...q, selectedAnswer: answer } : q,
            ),
          }))
        }
        onSubmit={(id) => setModel((current) => solveQuestion(current, id))}
        onRelease={(id) =>
          setModel((current) => ({
            ...current,
            state: "investigating",
            questions: current.questions.map((q) =>
              q.id === id
                ? { ...q, status: "claimed" as const, claimedByName: current.meName, selectedAnswer: "" }
                : q,
            ),
          }))
        }
      />
    </div>
  );
}
