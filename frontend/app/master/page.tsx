"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTeamSocket } from "@/hooks/useTeamSocket";
import {
  ApiError,
  getMasterStatus,
  getStoredToken,
  verifyMasterCode,
  type MasterStatusOut,
} from "@/lib/api";

const CHECKLIST = [
  "Identity verified",
  "Investigation complete",
  "Access key verified",
];

// Boot-log lines shown above each state — purely presentational, no new
// backend calls. Kept short and monospace to read like a real terminal
// session rather than a form with a title.
function bootLines(status: MasterStatusOut): string[] {
  if (!status.eligible && !status.solved) {
    return [
      "> connecting to master terminal...",
      "> access denied: round 2 incomplete",
    ];
  }
  if (status.eligible && !status.solved) {
    return [
      "> connecting to master terminal...",
      "> round 2 status: complete",
      "> access key required",
    ];
  }
  return [
    "> key verified",
    "> decrypting round 3 payload...",
    "> access level elevated",
  ];
}

export default function MasterPage() {
  const router = useRouter();
  const [status, setStatus] = useState<MasterStatusOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; message: string } | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getMasterStatus();
      setStatus(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to load system status.");
    }
  }, [router]);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    fetchStatus();
  }, [router, fetchStatus]);

  useTeamSocket(
    useCallback(
      (event) => {
        if (event.type === "master_terminal_unlocked") fetchStatus();
      },
      [fetchStatus]
    )
  );

  async function handleVerify() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const res = await verifyMasterCode(code.trim());
      setResult(res);
      if (res.correct) {
        setStatus((s) => (s ? { ...s, solved: true } : s));
      } else {
        setShake(true);
        setTimeout(() => setShake(false), 420);
        setCode("");
        inputRef.current?.focus();
      }
    } catch (err) {
      setResult({
        correct: false,
        message: err instanceof ApiError ? err.message : "Verification failed.",
      });
      setShake(true);
      setTimeout(() => setShake(false), 420);
    } finally {
      setBusy(false);
    }
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

  if (!status) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="font-mono-data text-sm text-muted-foreground">
          ESTABLISHING SECURE CONNECTION...
        </p>
      </main>
    );
  }

  const solved = status.solved || result?.correct;
  const wrongKey = result !== null && !result.correct;

  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      {/* subtle grid wash, matches landing page background treatment */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.92 0.29 128 / 4%) 1px, transparent 1px), linear-gradient(90deg, oklch(0.92 0.29 128 / 4%) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* top chrome — connection status bar, not a page title */}
      <div className="relative z-10 flex items-center justify-between border-b border-border px-6 py-5 sm:px-8">
        <span className="glow-lime font-mono-data text-xs font-bold tracking-widest text-primary uppercase">
          DigiHunt // System Access
        </span>
        <span className="flex items-center gap-2 font-mono-data text-[11px] tracking-widest text-muted-foreground uppercase">
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary"
            style={{ boxShadow: "0 0 6px var(--primary)" }}
          />
          Connection secure
        </span>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          {/* boot log */}
          <div className="mb-7 space-y-1.5 font-mono-data text-[11px] leading-relaxed text-muted-foreground">
            {bootLines(status).map((line, i) => (
              <p
                key={line}
                className={
                  solved
                    ? "glow-lime text-primary"
                    : !status.eligible
                      ? i === 1
                        ? "text-destructive"
                        : undefined
                      : undefined
                }
              >
                {line}
              </p>
            ))}
          </div>

          {/* STATE: not eligible */}
          {!status.eligible && !solved && (
            <div
              className="border border-destructive p-7"
              style={{
                background:
                  "linear-gradient(160deg, oklch(0.63 0.22 25 / 6%), transparent 60%)",
              }}
            >
              <h1 className="mb-2 font-heading text-xl font-bold uppercase tracking-wide text-destructive">
                System locked
              </h1>
              <p className="mb-6 font-mono-data text-xs leading-relaxed text-muted-foreground">
                Complete Round 2 to establish a connection to the Master Terminal.
              </p>
              <Button
                variant="outline"
                className="font-mono-data"
                onClick={() => router.push("/round2")}
              >
                GO TO ROUND 2
              </Button>
            </div>
          )}

          {/* STATE: awaiting key (includes wrong-key flash) */}
          {status.eligible && !solved && (
            <div
              className={`border p-7 transition-colors duration-200 ${
                wrongKey
                  ? "border-destructive"
                  : "glow-border border-primary"
              } ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
              style={{
                background: wrongKey
                  ? "oklch(0.63 0.22 25 / 4%)"
                  : "linear-gradient(160deg, oklch(0.92 0.29 128 / 5%), transparent 60%)",
              }}
            >
              <p className="mb-1 font-mono-data text-[11px] uppercase tracking-widest text-muted-foreground">
                Master Terminal
              </p>
              <h1 className="glow-cyan mb-5 font-heading text-2xl font-bold uppercase tracking-wide text-primary">
                Enter access key
              </h1>

              <div
                className={`mb-4 flex items-center border px-4 py-3.5 ${
                  wrongKey ? "border-destructive bg-destructive/5" : "border-border bg-input"
                }`}
              >
                <span
                  className={`mr-2.5 font-mono-data text-base ${
                    wrongKey ? "text-destructive" : "text-primary"
                  }`}
                >
                  &gt;
                </span>
                <input
                  ref={inputRef}
                  id="master-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVerify();
                  }}
                  disabled={busy}
                  placeholder="D1G1-XX-XX-XX"
                  autoFocus
                  className={`w-full bg-transparent font-mono-data text-base tracking-[0.2em] uppercase outline-none placeholder:text-muted-foreground/50 ${
                    wrongKey ? "text-destructive" : "text-foreground"
                  }`}
                />
              </div>

              <Button
                className="w-full font-mono-data uppercase tracking-widest"
                disabled={busy || !code.trim()}
                onClick={handleVerify}
              >
                {busy ? "Verifying..." : "Submit access key"}
              </Button>

              {wrongKey && (
                <p className="mt-3 font-mono-data text-[11px] tracking-wide text-destructive">
                  ✕ {result?.message ?? "ACCESS DENIED"} — attempt logged.
                </p>
              )}

              <p className="mt-4 font-mono-data text-[10px] tracking-wide text-muted-foreground">
                This is the access key your team earned by completing Round 1.
              </p>
            </div>
          )}

          {/* STATE: granted */}
          {solved && (
            <div
              className="glow-border border border-primary p-7"
              style={{
                background:
                  "linear-gradient(160deg, oklch(0.92 0.29 128 / 8%), transparent 65%)",
              }}
            >
              <h1 className="glow-cyan mb-5 font-heading text-2xl font-bold uppercase tracking-wide text-primary">
                {result?.correct ? "Access granted" : "Access granted — Round 3 unlocked"}
              </h1>

              <div className="mb-6 flex flex-col gap-2.5">
                {CHECKLIST.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2.5 font-mono-data text-sm text-foreground"
                  >
                    <span className="glow-lime text-primary">✓</span>
                    {item}
                  </div>
                ))}
              </div>

              <Button
                className="w-full font-mono-data uppercase tracking-widest"
                onClick={() => router.push("/round3")}
              >
                Enter Round 3 →
              </Button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <span className="font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
              Team access panel
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
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-6px);
          }
          40% {
            transform: translateX(5px);
          }
          60% {
            transform: translateX(-4px);
          }
          80% {
            transform: translateX(3px);
          }
        }
      `}</style>
    </main>
  );
}
