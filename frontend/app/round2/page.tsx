"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTeamSocket } from "@/hooks/useTeamSocket";
import { ApiError, answerQuestion, claimQuestion, getIncident, getMe, getRound2Board, getStoredToken, releaseQuestion, type IncidentOut, type QuestionBoardItem, type Round2BoardOut } from "@/lib/api";
import { Round2View } from "@/features/round2/round2-view";
import type { Round2EvidenceId, Round2Question, Round2ViewModel, Round2ViewState } from "@/features/round2/round2-types";

const POLL_MS = 4000;
const BOARD_EVENTS = new Set(["question_claimed", "question_released", "question_solved", "round_progress_updated", "round_unlocked"]);
const CATEGORY_LABEL: Record<string, string> = { who: "WHO", what: "WHAT", when: "WHEN", how: "HOW", why: "WHY" };

function toEvidence(incident: IncidentOut | null) {
  return incident ? { serverLog: incident.server_log, suspiciousEmail: incident.suspicious_email, userActivity: incident.user_activity, codeSnippet: incident.code_snippet, timeline: incident.timeline } : null;
}

function toQuestion(q: QuestionBoardItem, selected: Record<string, string>, busy: Record<string, boolean>, feedback: Record<string, { correct: boolean; message: string }>): Round2Question {
  return { id: q.team_question_id, category: q.category, label: CATEGORY_LABEL[q.category] ?? q.category.toUpperCase(), difficulty: q.difficulty, questionText: q.question_text, options: q.options ?? [], status: q.status, claimedByName: q.claimed_by_name, selectedAnswer: selected[q.team_question_id] ?? "", busy: !!busy[q.team_question_id], feedback: feedback[q.team_question_id] ?? null };
}

export default function Round2Page() {
  const router = useRouter();
  const [board, setBoard] = useState<Round2BoardOut | null>(null);
  const [incident, setIncident] = useState<IncidentOut | null>(null);
  const [meName, setMeName] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, { correct: boolean; message: string }>>({});
  const [activeEvidenceId, setActiveEvidenceId] = useState<Round2EvidenceId>("log");

  const fetchBoard = useCallback(async () => {
    try {
      const data = await getRound2Board();
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
      setError(err instanceof ApiError ? err.message : "Failed to load board.");
    }
  }, [router]);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    getMe().then((me) => setMeName(me.name)).catch(() => {});
    getIncident().then(setIncident).catch(() => {});
    fetchBoard();
    const interval = setInterval(fetchBoard, POLL_MS);
    return () => clearInterval(interval);
  }, [router, fetchBoard]);

  useTeamSocket(useCallback((event) => { if (BOARD_EVENTS.has(event.type)) fetchBoard(); }, [fetchBoard]));

  async function handleClaim(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    try { await claimQuestion(id); await fetchBoard(); }
    catch (err) { setFeedback((f) => ({ ...f, [id]: { correct: false, message: err instanceof ApiError ? err.message : "Could not claim clue." } })); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function handleRelease(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    try { await releaseQuestion(id); setSelected((s) => ({ ...s, [id]: "" })); await fetchBoard(); }
    catch (err) { setFeedback((f) => ({ ...f, [id]: { correct: false, message: err instanceof ApiError ? err.message : "Could not release clue." } })); }
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

  const model = useMemo<Round2ViewModel>(() => {
    const state: Round2ViewState = locked ? "locked" : !board && !error ? "loading" : board?.investigation_complete ? "complete" : Object.values(feedback).some((f) => !f.correct) ? "incorrect" : board?.questions.some((q) => q.status === "claimed" && q.claimed_by_name !== meName) ? "teammate-claimed" : "investigating";
    return { state, meName, evidence: toEvidence(incident), activeEvidenceId, questions: board?.questions.map((q) => toQuestion(q, selected, busy, feedback)) ?? [], summary: board?.summary ?? null, error };
  }, [activeEvidenceId, board, busy, error, feedback, incident, locked, meName, selected]);

  return <Round2View model={model} onBack={() => router.push("/dashboard")} onBackToRound1={() => router.push("/round1")} onEvidenceTabChange={setActiveEvidenceId} onClaim={handleClaim} onSelect={(id, answer) => setSelected((s) => ({ ...s, [id]: answer }))} onSubmit={handleSubmit} onRelease={handleRelease} />;
}
