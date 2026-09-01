"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTeamSocket } from "@/hooks/useTeamSocket";
import {
  ApiError,
  getStoredToken,
  logout,
  getTeamMe,
  type TeamMeOut,
} from "@/lib/api";

const REFETCH_EVENTS = new Set([
  "round_progress_updated",
  "round_unlocked",
  "master_terminal_unlocked",
]);

function RoundBar({ solved, total }: { solved: number; total: number }) {
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
  return (
    <div className="h-1 w-full overflow-hidden bg-muted">
      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

// Full-width feature row for Round 1 — mirrors the numbered stage rows
// on the landing page (big ghost-outline numeral + hairline top border).
function FeatureRoundRow({
  num,
  title,
  subtitle,
  solved,
  total,
  locked,
  lockedMessage = "Unlocks later in the hunt.",
  onOpen,
}: {
  num: string;
  title: string;
  subtitle: string;
  solved: number;
  total: number;
  locked: boolean;
  lockedMessage?: string;
  onOpen: () => void;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-5 border-t border-border py-8 sm:grid-cols-[100px_1fr] ${
        locked ? "opacity-50" : "cursor-pointer"
      }`}
      onClick={locked ? undefined : onOpen}
    >
      <div
        className="font-heading text-[58px] leading-none font-bold text-transparent"
        style={{ WebkitTextStroke: "1.5px oklch(0.919 0.237 127.1 / 0.3)" }}
      >
        {num}
      </div>
      <div>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono-data text-xs tracking-widest text-primary uppercase">
            {subtitle}
          </span>
          {locked ? (
            <Badge variant="outline" className="font-mono-data">
              LOCKED
            </Badge>
          ) : total === 0 ? (
            <Badge className="font-mono-data">AVAILABLE</Badge>
          ) : (
            <span className="font-mono-data text-xs text-muted-foreground">
              {solved}/{total} SOLVED
            </span>
          )}
        </div>
        <h3 className="mb-4 font-heading text-xl font-bold text-foreground uppercase sm:text-2xl">
          {title}
        </h3>
        {locked ? (
          <p className="font-mono-data text-xs text-muted-foreground">{lockedMessage}</p>
        ) : (
          <div className="max-w-xs space-y-2">
            <RoundBar solved={solved} total={total} />
            <p className="font-mono-data text-xs text-primary">ENTER →</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact tile for the secondary rounds grid.
function RoundTile({
  title,
  solved,
  total,
  locked,
  lockedMessage = "Unlocks later in the hunt.",
  onOpen,
}: {
  title: string;
  solved: number;
  total: number;
  locked: boolean;
  lockedMessage?: string;
  onOpen: () => void;
}) {
  if (locked) {
    return (
      <div className="border border-border p-5 opacity-50">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono-data text-xs text-muted-foreground">{title}</span>
          <Badge variant="outline" className="font-mono-data">
            LOCKED
          </Badge>
        </div>
        <p className="font-mono-data text-xs text-muted-foreground">{lockedMessage}</p>
      </div>
    );
  }

  return (
    <div
      className="glow-border cursor-pointer border border-border p-5 transition-transform hover:scale-[1.01]"
      onClick={onOpen}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono-data text-xs text-secondary">{title}</span>
        {total === 0 ? (
          <Badge className="font-mono-data">AVAILABLE</Badge>
        ) : (
          <span className="font-mono-data text-xs text-muted-foreground">
            {solved}/{total}
          </span>
        )}
      </div>
      <div className="space-y-2">
        <RoundBar solved={solved} total={total} />
        <p className="font-mono-data text-xs text-primary">ENTER →</p>
      </div>
    </div>
  );
}

function MasterTile({
  locked,
  solved,
  onOpen,
}: {
  locked: boolean;
  solved: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      className={`border border-border p-5 ${
        locked ? "opacity-50" : "glow-border cursor-pointer transition-transform hover:scale-[1.01]"
      }`}
      onClick={locked ? undefined : onOpen}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono-data text-xs text-muted-foreground">MASTER TERMINAL</span>
        <Badge variant={locked ? "outline" : undefined} className="font-mono-data">
          {solved ? "COMPLETE" : locked ? "LOCKED" : "UNLOCKED"}
        </Badge>
      </div>
      <p className="font-mono-data text-xs text-muted-foreground">
        {solved
          ? "Access granted — Round 3 unlocked."
          : locked
            ? "Unlocks after Round 2 is complete."
            : "Enter your access key."}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamMeOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  const fetchTeam = useCallback(() => {
    getTeamMe()
      .then(setTeam)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          router.replace("/login");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load team.");
      });
  }, [router]);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    fetchTeam();
  }, [router, fetchTeam]);

  useTeamSocket(
    useCallback(
      (event) => {
        if (event.type === "member_online" && typeof event.user_id === "string") {
          setOnlineIds((s) => new Set(s).add(event.user_id as string));
        } else if (event.type === "member_offline" && typeof event.user_id === "string") {
          setOnlineIds((s) => {
            const next = new Set(s);
            next.delete(event.user_id as string);
            return next;
          });
        }
        if (REFETCH_EVENTS.has(event.type)) fetchTeam();
      },
      [fetchTeam]
    )
  );

  function handleLogout() {
    logout();
    router.push("/");
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono-data text-sm text-destructive">
          {error}
        </p>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="font-mono-data text-sm text-muted-foreground">LOADING MISSION DATA...</p>
      </main>
    );
  }

  const { round1, round2, round3, master } = team.rounds;

  return (
    <main className="flex flex-col">
      {/* HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary"
            style={{ boxShadow: "0 0 6px var(--primary)" }}
          />
          <span className="font-mono-data text-sm font-bold tracking-widest text-foreground uppercase">
            DigiHunt // Mission Control
          </span>
        </div>
        <Button variant="outline" className="font-mono-data" onClick={handleLogout}>
          LOGOUT
        </Button>
      </header>

      <div className="mx-auto w-full max-w-[1100px] px-5 sm:px-8">
        {/* TEAM ID STRIP */}
        <section
          className="my-10 flex flex-col items-start justify-between gap-6 border border-border p-7 sm:flex-row sm:items-center"
          style={{ background: "linear-gradient(160deg, oklch(0.919 0.237 127.1 / 6%), transparent 55%)" }}
        >
          <div>
            <p className="mb-2 font-mono-data text-[11px] tracking-widest text-muted-foreground uppercase">
              Team Code
            </p>
            <p className="glow-lime font-mono-data text-4xl font-bold tracking-widest text-primary sm:text-5xl">
              {team.team_code}
            </p>
            <p className="mt-2 font-mono-data text-sm text-secondary">{team.team_name}</p>
          </div>
          <div className="flex gap-6 border-t border-border pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
            <div>
              <div className="mb-1.5 font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
                Members
              </div>
              <div className="font-heading text-lg font-bold text-foreground">
                {team.members.length}
              </div>
            </div>
            <div>
              <div className="mb-1.5 font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
                Online
              </div>
              <div className="font-heading text-lg font-bold text-primary">
                {onlineIds.size}
              </div>
            </div>
          </div>
        </section>

        {/* ROSTER */}
        <section className="mb-14">
          <span className="mb-4 block font-mono-data text-xs font-bold tracking-widest text-primary uppercase">
            — Team Roster
          </span>
          <div className="border-t border-border">
            {team.members.map((m) => {
              const online = onlineIds.has(m.id);
              return (
                <div
                  key={m.id}
                  className={`flex items-center justify-between border-b border-border py-4 ${
                    m.is_you ? "px-4" : ""
                  }`}
                  style={m.is_you ? { background: "oklch(0.919 0.237 127.1 / 5%)" } : undefined}
                >
                  <span className="flex items-center gap-2.5 font-mono-data text-sm text-foreground">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        online ? "glow-lime bg-primary" : "bg-muted-foreground/40"
                      }`}
                      title={online ? "Online" : "Offline"}
                    />
                    {m.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
                      {online ? "ONLINE" : "OFFLINE"}
                    </span>
                    {m.is_you && <Badge className="font-mono-data">YOU</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* MISSION PROGRESS */}
        <section className="mb-16">
          <span className="mb-1 block font-mono-data text-xs font-bold tracking-widest text-primary uppercase">
            — Mission Progress
          </span>
          <p className="mb-2 max-w-md font-mono-data text-xs text-muted-foreground">
            Each round unlocks the next. Solve every question to move forward.
          </p>

          <FeatureRoundRow
            num="01"
            subtitle="Round 1 — The Digital Trail"
            title="Find the Clues"
            solved={round1.solved}
            total={round1.total}
            locked={round1.locked}
            onOpen={() => router.push("/round1")}
          />

          <div className="grid gap-4 border-t border-border pt-8 sm:grid-cols-3">
            <RoundTile
              title="ROUND 2 · DIGITAL DETECTIVES"
              solved={round2.solved}
              total={round2.total}
              locked={round2.locked}
              onOpen={() => router.push("/round2")}
            />
            <RoundTile
              title="ROUND 3 · THE FINAL HACK"
              solved={round3.solved}
              total={round3.total}
              locked={round3.locked}
              lockedMessage="Unlocks after the Master Terminal."
              onOpen={() => router.push("/round3")}
            />
            <MasterTile
              locked={master.locked}
              solved={master.solved}
              onOpen={() => router.push("/master")}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
