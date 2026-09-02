"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import { useRouter } from "next/navigation";
import { Round1View } from "@/features/round1/round1-view";
import type { Round1Clue, Round1Feedback, Round1ViewModel } from "@/features/round1/round1-types";
import { useTeamSocket } from "@/hooks/useTeamSocket";
import {
  ApiError,
  answerQuestion,
  claimQuestion,
  getMe,
  getRound1Board,
  getStoredToken,
  releaseQuestion,
  type QuestionBoardItem,
  type RoundBoardOut,
} from "@/lib/api";

const POLL_MS = 4000;
const BOARD_EVENTS = new Set([
  "question_claimed",
  "question_released",
  "question_solved",
  "round_progress_updated",
  "round_unlocked",
]);

type ControllerState = {
  board: RoundBoardOut | null;
  meName: string | null;
  selectedAnswer: string;
  busy: boolean;
  feedback: Round1Feedback | null;
  claimingId: string | null;
  selectedClueId: string | null;
};

type ControllerAction =
  | { type: "board"; board: RoundBoardOut }
  | { type: "me"; name: string }
  | { type: "select"; answer: string }
  | { type: "busy"; busy: boolean }
  | { type: "feedback"; feedback: Round1Feedback | null }
  | { type: "claiming"; id: string | null }
  | { type: "selected-clue"; id: string | null };

const initialState: ControllerState = {
  board: null,
  meName: null,
  selectedAnswer: "",
  busy: false,
  feedback: null,
  claimingId: null,
  selectedClueId: null,
};

function reducer(state: ControllerState, action: ControllerAction): ControllerState {
  switch (action.type) {
    case "board":
      return { ...state, board: action.board, selectedAnswer: "", feedback: null, claimingId: null };
    case "me":
      return { ...state, meName: action.name };
    case "select":
      return { ...state, selectedAnswer: action.answer };
    case "busy":
      return { ...state, busy: action.busy };
    case "feedback":
      return { ...state, feedback: action.feedback };
    case "claiming":
      return { ...state, claimingId: action.id };
    case "selected-clue":
      return { ...state, selectedClueId: action.id, selectedAnswer: "", feedback: null };
  }
}

function toClue(question: QuestionBoardItem): Round1Clue {
  return {
    id: question.team_question_id,
    category: question.category,
    difficulty: question.difficulty,
    questionText: question.question_text,
    options: question.options ?? [],
    status: question.status,
    claimedByName: question.claimed_by_name,
    codeFragment: question.code_fragment,
  };
}

function currentIndex(board: RoundBoardOut | null, selectedClueId: string | null) {
  if (!board) return -1;
  const selectedIndex = board.questions.findIndex(
    (question) => question.team_question_id === selectedClueId && question.status !== "solved",
  );
  if (selectedIndex >= 0) return selectedIndex;
  const index = board.questions.findIndex((question) => question.status !== "solved");
  return index === -1 ? board.questions.length : index;
}

export default function Round1Page() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchBoard = useCallback(async () => {
    try {
      dispatch({ type: "board", board: await getRound1Board() });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      dispatch({ type: "feedback", feedback: { tone: "error", message: err instanceof ApiError ? err.message : "Failed to load board." } });
    }
  }, [router]);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    getMe().then((me) => dispatch({ type: "me", name: me.name })).catch(() => {});
    fetchBoard();
    const interval = setInterval(fetchBoard, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchBoard, router]);

  useTeamSocket(useCallback((event) => {
    if (BOARD_EVENTS.has(event.type)) fetchBoard();
  }, [fetchBoard]));

  const index = currentIndex(state.board, state.selectedClueId);
  const current = state.board && index < state.board.questions.length ? state.board.questions[index] : null;

  const model: Round1ViewModel = useMemo(() => {
    const clues = state.board?.questions.map(toClue) ?? [];
    const active = index >= 0 ? clues[index] : null;
    const stateName = !state.board
      ? "loading"
      : state.board.all_complete
        ? "complete"
        : active?.status === "available"
          ? "available"
          : active?.status === "claimed" && active.claimedByName !== state.meName
            ? "teammate-claimed"
            : state.feedback?.tone === "error"
              ? "incorrect"
              : "answering";
    return {
      state: stateName,
      meName: state.meName,
      clues,
      currentIndex: index,
      selectedAnswer: state.selectedAnswer,
      nextGateRound: state.board?.next_gate_round ?? null,
      feedback: state.feedback,
      busy: state.busy || Boolean(state.claimingId),
    };
  }, [index, state]);

  async function handleSubmit() {
    if (!current || !state.selectedAnswer) return;
    dispatch({ type: "busy", busy: true });
    try {
      const result = await answerQuestion(current.team_question_id, state.selectedAnswer);
      dispatch({ type: "feedback", feedback: { tone: result.correct ? "success" : "error", message: result.correct ? `ACCESS GRANTED — ${result.message}` : "ACCESS DENIED — Incorrect response. Try again." } });
      if (result.correct) fetchBoard();
    } catch (err) {
      dispatch({ type: "feedback", feedback: { tone: "error", message: err instanceof ApiError ? err.message : "Submission failed." } });
    } finally {
      dispatch({ type: "busy", busy: false });
    }
  }

  function handleOpen(id: string) {
    dispatch({ type: "selected-clue", id });
  }

  async function handleClaim(id: string) {
    dispatch({ type: "selected-clue", id });
    const clue = state.board?.questions.find((question) => question.team_question_id === id);
    if (!clue || clue.status !== "available") return;
    dispatch({ type: "claiming", id });
    try {
      await claimQuestion(id);
      await fetchBoard();
    } catch (err) {
      dispatch({ type: "feedback", feedback: { tone: "error", message: err instanceof ApiError ? err.message : "Could not claim clue." } });
    } finally {
      dispatch({ type: "claiming", id: null });
    }
  }

  async function handleRelease() {
    if (!current) return;
    dispatch({ type: "busy", busy: true });
    try {
      await releaseQuestion(current.team_question_id);
      fetchBoard();
    } catch (err) {
      dispatch({ type: "feedback", feedback: { tone: "error", message: err instanceof ApiError ? err.message : "Could not release clue." } });
    } finally {
      dispatch({ type: "busy", busy: false });
    }
  }

  return (
    <Round1View
      model={model}
      onBack={() => router.push("/dashboard")}
      onOpenGate={() => router.push("/gate/2")}
      onOpen={handleOpen}
      onClaim={handleClaim}
      onSelect={(answer) => dispatch({ type: "select", answer })}
      onSubmit={handleSubmit}
      onRelease={handleRelease}
    />
  );
}
