"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import { useParams, useRouter } from "next/navigation";
import { GateView } from "@/features/gate/gate-view";
import type { GateViewModel } from "@/features/gate/gate-types";
import { useTeamSocket } from "@/hooks/useTeamSocket";
import {
  ApiError,
  getGate,
  getStoredToken,
  unlockGate,
  type GateStatusOut,
} from "@/lib/api";

type ControllerState = {
  status: GateStatusOut | null;
  answer: string;
  submitting: boolean;
  message: string | null;
  attempts: number;
  error: string | null;
};

type ControllerAction =
  | { type: "status"; status: GateStatusOut }
  | { type: "answer"; value: string }
  | { type: "submitting"; submitting: boolean }
  | { type: "result"; correct: boolean; message: string; unlocked: boolean }
  | { type: "error"; message: string | null };

const initialState: ControllerState = {
  status: null,
  answer: "",
  submitting: false,
  message: null,
  attempts: 0,
  error: null,
};

function reducer(state: ControllerState, action: ControllerAction): ControllerState {
  switch (action.type) {
    case "status":
      return {
        ...state,
        status: action.status,
        attempts: action.status.attempts,
        error: null,
      };
    case "answer":
      return { ...state, answer: action.value };
    case "submitting":
      return { ...state, submitting: action.submitting };
    case "result":
      return {
        ...state,
        message: action.message,
        attempts: state.attempts + 1,
        answer: action.correct ? state.answer : "",
        status: state.status ? { ...state.status, unlocked: action.unlocked } : state.status,
      };
    case "error":
      return { ...state, error: action.message };
  }
}

export default function GatePage() {
  const router = useRouter();
  const params = useParams<{ round: string }>();
  const roundNumber = Number(params.round);
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchStatus = useCallback(async () => {
    try {
      dispatch({ type: "status", status: await getGate(roundNumber) });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      dispatch({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to load gate status.",
      });
    }
  }, [roundNumber, router]);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    fetchStatus();
  }, [fetchStatus, router]);

  useTeamSocket(
    useCallback(
      (event) => {
        if (event.type === "round_progress_updated" || event.type === "round_unlocked") fetchStatus();
      },
      [fetchStatus],
    ),
  );

  async function handleSubmit() {
    if (!state.answer.trim()) return;
    dispatch({ type: "submitting", submitting: true });
    try {
      const result = await unlockGate(roundNumber, state.answer.trim());
      dispatch({ type: "result", correct: result.correct, message: result.message, unlocked: result.unlocked });
    } catch (err) {
      dispatch({
        type: "result",
        correct: false,
        message: err instanceof ApiError ? err.message : "Verification failed.",
        unlocked: false,
      });
    } finally {
      dispatch({ type: "submitting", submitting: false });
    }
  }

  const model: GateViewModel = useMemo(() => {
    const status = state.status;
    const stateName = !status
      ? "loading"
      : status.unlocked
        ? "unlocked"
        : !status.ready
          ? "locked"
          : state.submitting
            ? "submitting"
            : state.message
              ? "rejected"
              : "ready";
    return {
      state: stateName,
      roundNumber,
      sourceRound: status?.source_round ?? roundNumber - 1,
      hint: status?.hint ?? null,
      wordLengths: status?.word_lengths ?? [],
      answer: state.answer,
      attempts: state.attempts,
      message:
        state.message ?? (status?.unlocked ? `Round ${roundNumber} already unlocked` : null),
    };
  }, [roundNumber, state]);

  if (state.error) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <p className="border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono-data text-sm text-destructive">
          {state.error}
        </p>
      </main>
    );
  }

  return (
    <GateView
      model={model}
      onChangeKey={(value) => dispatch({ type: "answer", value })}
      onSubmit={handleSubmit}
      onBack={() => {
        if (model.state === "unlocked") {
          router.push(`/round${roundNumber}`);
        } else {
          router.push("/dashboard");
        }
      }}
    />
  );
}
