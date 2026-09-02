"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTeamSocket } from "@/hooks/useTeamSocket";
import { ApiError, answerQuestion, claimQuestion, getMe, getRound3Board, getStoredToken, releaseQuestion, type QuestionBoardItem, type RoundBoardOut } from "@/lib/api";
import { Round3View } from "@/features/round3/round3-view";
import type { Round3Question, Round3ViewModel, Round3ViewState } from "@/features/round3/round3-types";

const POLL_MS = 4000;
const BOARD_EVENTS = new Set(["question_claimed", "question_released", "question_solved", "round_progress_updated", "round_unlocked"]);
const CATEGORY_LABEL: Record<string, string> = {
  access_control: "ACCESS",
  secure_coding: "CODE",
  monitoring: "MONITOR",
  incident_response: "RESPONSE",
  crypto_hygiene: "CRYPTO",
};

function toQuestion(q: QuestionBoardItem, selected: Record<string, string>, busy: Record<string, boolean>, feedback: Record<string, { correct: boolean; message: string }>): Round3Question {
  return { id: q.team_question_id, category: q.category, label: CATEGORY_LABEL[q.category] ?? q.category.toUpperCase(), difficulty: q.difficulty, questionText: q.question_text, options: q.options ?? [], status: q.status, claimedByName: q.claimed_by_name, selectedAnswer: selected[q.team_question_id] ?? "", busy: !!busy[q.team_question_id], codeFragment: q.code_fragment, feedback: feedback[q.team_question_id] ?? null };
}

export default function Round3Page() {
  const router = useRouter();
  const [board, setBoard] = useState<RoundBoardOut | null>(null);
  const [meName, setMeName] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, { correct: boolean; message: string }>>({});

  const fetchBoard = useCallback(async () => {
    try {
      const data = await getRound3Board();
      setBoard(data);
      setLocked(false);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        setLocked(true);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to load final hack.");
    }
  }, [router]);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    getMe().then((me) => setMeName(me.name)).catch(() => {});
    fetchBoard();
    const interval = setInterval(fetchBoard, POLL_MS);
    return () => clearInterval(interval);
  }, [router, fetchBoard]);

  useTeamSocket(useCallback((event) => { if (BOARD_EVENTS.has(event.type)) fetchBoard(); }, [fetchBoard]));

  async function handleClaim(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    try { await claimQuestion(id); await fetchBoard(); }
    catch (err) { setFeedback((f) => ({ ...f, [id]: { correct: false, message: err instanceof ApiError ? err.message : "Could not claim question." } })); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function handleRelease(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    try { await releaseQuestion(id); setSelected((s) => ({ ...s, [id]: "" })); await fetchBoard(); }
    catch (err) { setFeedback((f) => ({ ...f, [id]: { correct: false, message: err instanceof ApiError ? err.message : "Could not release question." } })); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function handleSubmit(id: string) {
    const answer = selected[id];
    if (!answer) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try { const result = await answerQuestion(id, answer); setFeedback((f) => ({ ...f, [id]: { correct: result.correct, message: result.message } })); await fetchBoard(); }
    catch (err) { setFeedback((f) => ({ ...f, [id]: { correct: false, message: err instanceof ApiError ? err.message : "Submission failed." } })); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  const model = useMemo<Round3ViewModel>(() => {
    const state: Round3ViewState = locked ? "locked" : !board && !error ? "loading" : board?.all_complete ? "complete" : Object.values(feedback).some((f) => !f.correct) ? "incorrect" : board?.questions.some((q) => q.status === "claimed" && q.claimed_by_name !== meName) ? "teammate-claimed" : "solving";
    return { state, meName, questions: board?.questions.map((q) => toQuestion(q, selected, busy, feedback)) ?? [], error, nextGateRound: board?.next_gate_round ?? null };
  }, [board, busy, error, feedback, locked, meName, selected]);

  return <Round3View model={model} onBack={() => router.push("/dashboard")} onBackToRound2={() => router.push("/round2")} onOpenGate={() => router.push("/gate/4")} onClaim={handleClaim} onSelect={(id, answer) => setSelected((s) => ({ ...s, [id]: answer }))} onSubmit={handleSubmit} onRelease={handleRelease} />;
}
