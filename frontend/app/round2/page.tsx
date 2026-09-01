"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTeamSocket } from "@/hooks/useTeamSocket";
import {
  ApiError,
  answerQuestion,
  claimQuestion,
  getIncident,
  getMe,
  getRound2Board,
  getStoredToken,
  releaseQuestion,
  type IncidentOut,
  type QuestionBoardItem,
  type Round2BoardOut,
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
  who: "WHO",
  what: "WHAT",
  when: "WHEN",
  how: "HOW",
  why: "WHY",
};

const EVIDENCE_TABS = ["log", "email", "code", "timeline"] as const;
type EvidenceTab = (typeof EVIDENCE_TABS)[number];

const EVIDENCE_TAB_LABEL: Record<EvidenceTab, string> = {
  log: "SERVER LOG",
  email: "SUSPICIOUS EMAIL",
  code: "CODE SNIPPET",
  timeline: "TIMELINE",
};

function EvidencePane({ incident }: { incident: IncidentOut | null }) {
  const [tab, setTab] = useState<EvidenceTab>("log");

  if (!incident) {
    return (
      <p className="font-mono-data text-xs text-muted-foreground">
        LOADING EVIDENCE...
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3.5 font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
        Case evidence — read once
      </p>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {EVIDENCE_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border px-2.5 py-1.5 font-mono-data text-[10px] tracking-wide uppercase transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:border-secondary"
            }`}
          >
            {EVIDENCE_TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="border border-border bg-black/20 p-4">
        {tab === "log" && (
          <div className="space-y-1.5 font-mono-data text-xs text-foreground/90">
            {incident.server_log.map((l) => (
              <p key={l.time + l.event}>
                <span className="text-muted-foreground">[{l.time}]</span> {l.event}
              </p>
            ))}
          </div>
        )}
        {tab === "email" && (
          <div className="space-y-1.5 font-mono-data text-xs text-foreground/90">
            <p>
              <span className="text-muted-foreground">From:</span>{" "}
              {incident.suspicious_email.from}
            </p>
            <p>
              <span className="text-muted-foreground">Subject:</span>{" "}
              {incident.suspicious_email.subject}
            </p>
            <p className="pt-2 leading-relaxed">{incident.suspicious_email.body}</p>
            <p className="border-t border-border pt-3 text-muted-foreground">
              {incident.user_activity}
            </p>
          </div>
        )}
        {tab === "code" && (
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono-data text-xs text-primary">
            {incident.code_snippet}
          </pre>
        )}
        {tab === "timeline" && (
          <p className="font-mono-data text-xs leading-relaxed text-foreground/90">
            {incident.timeline}
          </p>
        )}
      </div>
    </div>
  );
}

function InvestigationSummary({ summary }: { summary: Record<string, string> }) {
  return (
    <div
      className="mb-4 border border-primary p-5"
      style={{ background: "linear-gradient(160deg, oklch(0.92 0.29 128 / 6%), transparent 60%)" }}
    >
      <p className="glow-lime mb-3 font-mono-data text-sm font-bold uppercase tracking-wide text-primary">
        Investigation complete — Round 3 unlocked
      </p>
      <div className="grid gap-1.5 font-mono-data text-xs text-foreground sm:grid-cols-2">
        {Object.entries(summary).map(([category, answer]) => (
          <p key={category}>
            <span className="text-secondary">
              {CATEGORY_LABEL[category] ?? category.toUpperCase()}:
            </span>{" "}
            {answer}
          </p>
        ))}
      </div>
    </div>
  );
}

// A solved question collapses to a thin strip — this is what makes the
// board read as a progress trail rather than a flat list of cards.
function SolvedStrip({ q }: { q: QuestionBoardItem }) {
  return (
    <div className="flex items-center justify-between border-l-2 border-border py-2.5 pl-4 opacity-50">
      <span className="font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
        {CATEGORY_LABEL[q.category] ?? q.category.toUpperCase()}
      </span>
      <span className="glow-lime font-mono-data text-[10px] text-primary">✓ SOLVED</span>
    </div>
  );
}

function AvailableStrip({
  q,
  onClaim,
  busy,
}: {
  q: QuestionBoardItem;
  onClaim: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClaim}
      disabled={busy}
      className="flex w-full items-center justify-between border-l-2 border-border py-2.5 pl-4 pr-2 text-left opacity-70 transition-opacity hover:opacity-100 disabled:opacity-40"
    >
      <span className="font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
        {CATEGORY_LABEL[q.category] ?? q.category.toUpperCase()} · {q.difficulty}
      </span>
      <span className="border border-border px-2 py-0.5 font-mono-data text-[9px] text-muted-foreground uppercase">
        {busy ? "CLAIMING..." : "CLAIM"}
      </span>
    </button>
  );
}

function LockedStrip({ q }: { q: QuestionBoardItem }) {
  return (
    <div className="flex items-center justify-between border-l-2 border-border py-2.5 pl-4 opacity-40">
      <span className="font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
        {CATEGORY_LABEL[q.category] ?? q.category.toUpperCase()}
      </span>
      <span className="font-mono-data text-[9px] text-muted-foreground">
        Being solved by {q.claimed_by_name ?? "a teammate"}...
      </span>
    </div>
  );
}

// The one expanded item — active question with answer options. Everything
// else on the board collapses to strips so this is the obvious focal point.
function ActiveQuestion({
  q,
  selected,
  onSelect,
  onSubmit,
  onRelease,
  feedback,
  busy,
}: {
  q: QuestionBoardItem;
  selected?: string;
  onSelect: (opt: string) => void;
  onSubmit: () => void;
  onRelease: () => void;
  feedback?: { correct: boolean; message: string };
  busy: boolean;
}) {
  return (
    <div
      className="glow-border border-l-2 border-primary bg-primary/[0.03] p-4"
      style={{ background: "linear-gradient(160deg, oklch(0.92 0.29 128 / 5%), transparent 60%)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono-data text-[10px] tracking-widest text-primary uppercase">
          {CATEGORY_LABEL[q.category] ?? q.category.toUpperCase()} · {q.difficulty}
        </span>
        <Badge className="font-mono-data text-[9px]">CLAIMED — YOU</Badge>
      </div>

      <p className="mb-3.5 font-mono-data text-sm text-foreground">{q.question_text}</p>

      <div className="mb-3.5 grid grid-cols-2 gap-1.5">
        {(q.options ?? []).map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={selected === opt}
            onClick={() => onSelect(opt)}
            className={`border px-2.5 py-2 text-left font-mono-data text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
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
          className={`mb-3.5 border px-3 py-2 font-mono-data text-xs ${
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

      <div className="flex gap-2">
        <Button
          size="sm"
          className="font-mono-data"
          disabled={busy || !selected}
          onClick={onSubmit}
        >
          {busy ? "SUBMITTING..." : "SUBMIT"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="font-mono-data"
          disabled={busy}
          onClick={onRelease}
        >
          RELEASE
        </Button>
      </div>
    </div>
  );
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
  const [feedback, setFeedback] = useState<
    Record<string, { correct: boolean; message: string }>
  >({});

  const fetchBoard = useCallback(async () => {
    try {
      const data = await getRound2Board();
      setBoard(data);
      setLocked(false);
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
    getMe()
      .then((me) => setMeName(me.name))
      .catch(() => {});
    getIncident()
      .then(setIncident)
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

  async function handleClaim(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await claimQuestion(id);
      await fetchBoard();
    } catch (err) {
      setFeedback((f) => ({
        ...f,
        [id]: {
          correct: false,
          message: err instanceof ApiError ? err.message : "Could not claim clue.",
        },
      }));
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function handleRelease(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await releaseQuestion(id);
      setSelected((s) => ({ ...s, [id]: "" }));
      await fetchBoard();
    } catch (err) {
      setFeedback((f) => ({
        ...f,
        [id]: {
          correct: false,
          message: err instanceof ApiError ? err.message : "Could not release clue.",
        },
      }));
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function handleSubmit(id: string) {
    const answer = selected[id];
    if (!answer) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const result = await answerQuestion(id, answer);
      setFeedback((f) => ({
        ...f,
        [id]: { correct: result.correct, message: result.message },
      }));
      await fetchBoard();
    } catch (err) {
      setFeedback((f) => ({
        ...f,
        [id]: {
          correct: false,
          message: err instanceof ApiError ? err.message : "Submission failed.",
        },
      }));
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  if (locked) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="glow-cyan font-mono-data text-xl font-bold text-primary">
          ROUND LOCKED
        </p>
        <p className="font-mono-data text-sm text-muted-foreground">
          Complete the previous mission objective to unlock this round.
        </p>
        <Button
          variant="outline"
          className="font-mono-data"
          onClick={() => router.push("/round1")}
        >
          BACK TO ROUND 1
        </Button>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono-data text-sm text-destructive">
          {error}
        </p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="font-mono-data text-sm text-muted-foreground">
          LOADING THE CASE FILE...
        </p>
      </main>
    );
  }

  const solvedCount = board.questions.filter((q) => q.status === "solved").length;

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5 sm:px-8">
        <h1 className="glow-cyan font-mono-data text-lg font-bold tracking-widest text-primary uppercase sm:text-xl">
          Round 2 // Digital Detectives
        </h1>
        <div className="flex items-center gap-4">
          <span className="font-mono-data text-xs tracking-widest text-muted-foreground">
            {solvedCount}/{board.questions.length} SOLVED
          </span>
          <Button
            variant="outline"
            size="sm"
            className="font-mono-data"
            onClick={() => router.push("/dashboard")}
          >
            MISSION CONTROL
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
        {/* LEFT — case evidence, read-once reference */}
        <div className="border-b border-border p-6 lg:border-r lg:border-b-0 sm:p-8">
          <EvidencePane incident={incident} />
        </div>

        {/* RIGHT — investigation board, the actual task */}
        <div className="p-6 sm:p-8">
          <p className="mb-3.5 font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
            Investigation board — the task
          </p>

          {board.investigation_complete && board.summary && (
            <InvestigationSummary summary={board.summary} />
          )}

          <div className="flex flex-col gap-2">
            {board.questions.map((q) => {
              const isMine = q.status !== "available" && q.claimed_by_name === meName;

              if (q.status === "solved") {
                return <SolvedStrip key={q.team_question_id} q={q} />;
              }

              if (q.status === "claimed" && isMine) {
                return (
                  <ActiveQuestion
                    key={q.team_question_id}
                    q={q}
                    selected={selected[q.team_question_id]}
                    onSelect={(opt) =>
                      setSelected((s) => ({ ...s, [q.team_question_id]: opt }))
                    }
                    onSubmit={() => handleSubmit(q.team_question_id)}
                    onRelease={() => handleRelease(q.team_question_id)}
                    feedback={feedback[q.team_question_id]}
                    busy={!!busy[q.team_question_id]}
                  />
                );
              }

              if (q.status === "claimed" && !isMine) {
                return <LockedStrip key={q.team_question_id} q={q} />;
              }

              return (
                <AvailableStrip
                  key={q.team_question_id}
                  q={q}
                  onClaim={() => handleClaim(q.team_question_id)}
                  busy={!!busy[q.team_question_id]}
                />
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
