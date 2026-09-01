"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  type Round1BoardOut,
} from "@/lib/api";

// The 4s poll stays as a safety-net fallback; the WebSocket push (G10) makes
// board updates near-instant by triggering an extra fetch on top of it.
const POLL_MS = 4000;
const BOARD_EVENTS = new Set([
  "question_claimed",
  "question_released",
  "question_solved",
  "round_progress_updated",
  "round_unlocked",
]);

const CATEGORY_LABEL: Record<string, string> = {
  binary: "BINARY",
  morse: "MORSE",
  cryptography: "CRYPTOGRAPHY",
  logic: "LOGIC",
  cybersecurity: "CYBERSECURITY",
};

// Progress rail — one dot per question in sequence order. Filled = solved,
// ringed = current, dim = not reached yet.
function ProgressRail({
  questions,
  currentIndex,
}: {
  questions: QuestionBoardItem[];
  currentIndex: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {questions.map((q, i) => {
        const solved = q.status === "solved";
        const isCurrent = i === currentIndex;
        return (
          <div
            key={q.team_question_id}
            className={`h-1.5 flex-1 ${
              solved
                ? "glow-lime bg-primary"
                : isCurrent
                  ? "bg-secondary"
                  : "bg-muted"
            }`}
            title={`Clue ${i + 1}${solved ? " — solved" : isCurrent ? " — current" : " — locked"}`}
          />
        );
      })}
    </div>
  );
}

// Owns the claim/answer flow for exactly one clue. Keyed by team_question_id
// from the parent, so React mounts a fresh instance (fresh local state) every
// time the current clue changes — no manual "reset on change" effect needed.
function ClueCard({
  question,
  meName,
  index,
  total,
  onSolved,
}: {
  question: QuestionBoardItem;
  meName: string | null;
  index: number;
  total: number;
  onSolved: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoClaiming, setAutoClaiming] = useState(question.status === "available");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(
    null
  );

  const isMine = question.status !== "available" && question.claimed_by_name === meName;

  // Auto-claim this clue as soon as it becomes the current one — the
  // sequence itself is the gate, so there's no manual "claim" button.
  useEffect(() => {
    if (question.status !== "available") return;
    let cancelled = false;
    claimQuestion(question.team_question_id)
      .then(() => {
        if (cancelled) return;
        setAutoClaiming(false);
        onSolved(); // reuse the same "refresh the board" callback
      })
      .catch((err) => {
        if (cancelled) return;
        setAutoClaiming(false);
        setClaimError(err instanceof ApiError ? err.message : "Could not claim clue.");
      });
    return () => {
      cancelled = true;
    };
    // Runs once per mount (i.e. once per clue, thanks to the parent's key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit() {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await answerQuestion(question.team_question_id, selected);
      setFeedback({ correct: result.correct, message: result.message });
      if (result.correct) onSolved();
    } catch (err) {
      setFeedback({
        correct: false,
        message: err instanceof ApiError ? err.message : "Submission failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRelease() {
    setBusy(true);
    try {
      await releaseQuestion(question.team_question_id);
      onSolved(); // refresh the board — a teammate can now auto-claim this clue
    } catch (err) {
      setFeedback({
        correct: false,
        message: err instanceof ApiError ? err.message : "Could not release clue.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glow-border border border-border p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-5">
        <span className="font-mono-data text-xs tracking-widest text-secondary uppercase">
          Clue {index + 1} of {total} —{" "}
          {CATEGORY_LABEL[question.category] ?? question.category.toUpperCase()}
        </span>
        <span className="font-mono-data text-xs text-muted-foreground uppercase">
          {question.difficulty}
        </span>
      </div>

      {autoClaiming || (question.status === "claimed" && !isMine) ? (
        <p className="font-mono-data text-sm text-muted-foreground">
          {question.status === "claimed" && !isMine
            ? `Being solved by ${question.claimed_by_name ?? "a teammate"}...`
            : "Establishing access..."}
        </p>
      ) : claimError ? (
        <p className="border border-destructive/40 bg-destructive/10 px-4 py-2.5 font-mono-data text-sm text-destructive">
          {claimError}
        </p>
      ) : (
        <div className="space-y-6">
          <p className="font-heading text-lg font-bold text-foreground sm:text-xl">
            {question.question_text}
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {(question.options ?? []).map((opt) => (
              <button
                key={opt}
                type="button"
                aria-pressed={selected === opt}
                onClick={() => setSelected(opt)}
                className={`border px-4 py-3 text-left font-mono-data text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                  selected === opt
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:border-secondary"
                }`}
              >
                {selected === opt ? "▸ " : ""}
                {opt}
              </button>
            ))}
          </div>

          {feedback && (
            <p
              className={`border px-4 py-2.5 font-mono-data text-sm ${
                feedback.correct
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {feedback.correct
                ? `ACCESS GRANTED — ${feedback.message}`
                : "ACCESS DENIED — Incorrect response. Try again."}
            </p>
          )}

          <div className="flex gap-2.5">
            <Button className="font-mono-data" disabled={busy || !selected} onClick={handleSubmit}>
              {busy ? "SUBMITTING..." : "SUBMIT"}
            </Button>
            <Button
              variant="outline"
              className="font-mono-data"
              disabled={busy}
              onClick={handleRelease}
            >
              RELEASE
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Round1Page() {
  const router = useRouter();
  const [board, setBoard] = useState<Round1BoardOut | null>(null);
  const [meName, setMeName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    try {
      const data = await getRound1Board();
      setBoard(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
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
    getMe()
      .then((me) => setMeName(me.name))
      .catch(() => {});
    fetchBoard();

    const interval = setInterval(fetchBoard, POLL_MS);
    return () => clearInterval(interval);
  }, [router, fetchBoard]);

  useTeamSocket(
    useCallback(
      (event) => {
        if (BOARD_EVENTS.has(event.type)) fetchBoard();
      },
      [fetchBoard]
    )
  );

  // Sequence is simply the array order the backend already returns.
  // The "current" clue is the first one in that order that isn't solved yet.
  const currentIndex = useMemo(() => {
    if (!board) return -1;
    const idx = board.questions.findIndex((q) => q.status !== "solved");
    return idx === -1 ? board.questions.length : idx;
  }, [board]);

  const current = board && currentIndex < board.questions.length
    ? board.questions[currentIndex]
    : null;

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono-data text-sm text-destructive">
          {error}
        </p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="font-mono-data text-sm text-muted-foreground">
          LOADING THE DIGITAL TRAIL...
        </p>
      </main>
    );
  }

  const total = board.questions.length;

  return (
    <main className="flex flex-col">
      {/* HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-6 sm:px-8">
        <h1 className="glow-lime font-mono-data text-lg font-bold tracking-widest text-primary uppercase sm:text-xl">
          Round 1 // The Digital Trail
        </h1>
        <Button
          variant="outline"
          className="font-mono-data"
          onClick={() => router.push("/dashboard")}
        >
          MISSION CONTROL
        </Button>
      </header>

      <div className="mx-auto w-full max-w-[760px] px-5 py-10 sm:px-8">
        {/* PROGRESS */}
        <div className="mb-10">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono-data text-xs tracking-widest text-muted-foreground uppercase">
              Clue Sequence
            </span>
            <span className="font-mono-data text-xs text-muted-foreground">
              {Math.min(currentIndex, total)}/{total} SOLVED
            </span>
          </div>
          <ProgressRail questions={board.questions} currentIndex={currentIndex} />
        </div>

        {board.all_complete ? (
          <section
            className="border border-primary p-8 text-center sm:p-12"
            style={{ background: "linear-gradient(160deg, oklch(0.919 0.237 127.1 / 8%), transparent 60%)" }}
          >
            <p className="mb-3 font-mono-data text-xs tracking-widest text-primary uppercase">
              — Code Fragments Recovered
            </p>
            <h2 className="mb-6 font-heading text-2xl font-bold text-foreground uppercase sm:text-3xl">
              Trail Complete
            </h2>
            <p className="mb-2 font-mono-data text-[11px] tracking-widest text-muted-foreground uppercase">
              Access Key
            </p>
            <p className="glow-lime break-all font-mono-data text-2xl font-bold tracking-widest text-secondary sm:text-3xl">
              {board.access_key}
            </p>
          </section>
        ) : current ? (
          <ClueCard
            // Keying by id forces a fresh mount (and thus fresh local state)
            // whenever the sequence advances to a new clue.
            key={current.team_question_id}
            question={current}
            meName={meName}
            index={currentIndex}
            total={total}
            onSolved={fetchBoard}
          />
        ) : null}

        {/* SOLVED SO FAR */}
        {currentIndex > 0 && (
          <section className="mt-12">
            <span className="mb-3 block font-mono-data text-xs font-bold tracking-widest text-muted-foreground uppercase">
              — Recovered Fragments
            </span>
            <div className="border-t border-border">
              {board.questions.slice(0, currentIndex).map((q, i) => (
                <div
                  key={q.team_question_id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3"
                >
                  <span className="font-mono-data text-xs text-muted-foreground">
                    Clue {i + 1} — {CATEGORY_LABEL[q.category] ?? q.category.toUpperCase()}
                    {q.claimed_by_name ? ` · solved by ${q.claimed_by_name}` : ""}
                  </span>
                  <span className="glow-lime font-mono-data text-xs text-primary">
                    {q.code_fragment}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
