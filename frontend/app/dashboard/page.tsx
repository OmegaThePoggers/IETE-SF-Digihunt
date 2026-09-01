"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardView } from "@/features/dashboard/dashboard-view";
import type {
  DashboardRound,
  DashboardRoundState,
  DashboardViewModel,
} from "@/features/dashboard/dashboard-fixtures";
import { useTeamSocket } from "@/hooks/useTeamSocket";
import {
  ApiError,
  getStoredToken,
  getTeamMe,
  logout,
  type RoundProgress,
  type TeamMeOut,
} from "@/lib/api";

const REFETCH_EVENTS = new Set([
  "round_progress_updated",
  "round_unlocked",
  "master_terminal_unlocked",
]);

const roundCopy = {
  round1: {
    index: "01",
    eyebrow: "The Digital Trail",
    title: "Find the clues",
    description: "Trace the first signal set and recover every fragment.",
    href: "/round1",
  },
  round2: {
    index: "02",
    eyebrow: "Digital Detectives",
    title: "Connect the evidence",
    description: "Interrogate the evidence board and resolve every open case.",
    href: "/round2",
  },
  round3: {
    index: "03",
    eyebrow: "The Final Hack",
    title: "Transmit the payload",
    description: "Complete the final operation and submit the recovered payload.",
    href: "/round3",
  },
} as const;

function progressState(progress: RoundProgress): DashboardRoundState {
  if (progress.locked) return "locked";
  if (progress.total > 0 && progress.solved >= progress.total) return "completed";
  return "active";
}

function mapRound(
  id: "round1" | "round2" | "round3",
  progress: RoundProgress,
): DashboardRound {
  return { id, ...roundCopy[id], ...progress, state: progressState(progress) };
}

export function toDashboardViewModel(
  team: TeamMeOut,
  onlineIds: ReadonlySet<string>,
): DashboardViewModel {
  const rounds: DashboardRound[] = [
    mapRound("round1", team.rounds.round1),
    mapRound("round2", team.rounds.round2),
    {
      id: "master",
      index: "M",
      eyebrow: "Master Terminal",
      title: "Authorize the final gate",
      description: team.rounds.master.solved
        ? "Access key accepted. The final operation is authorized."
        : "Enter the access key to authorize the final operation.",
      state: team.rounds.master.locked
        ? "locked"
        : team.rounds.master.solved
          ? "completed"
          : "active",
      solved: team.rounds.master.solved ? 1 : 0,
      total: 1,
      href: "/master",
    },
    mapRound("round3", team.rounds.round3),
  ];

  const activeRound = rounds.find((round) => round.state === "active");
  const currentRound = activeRound ?? [...rounds].reverse().find((round) => round.state === "completed") ?? rounds[0];
  const allComplete = rounds.every((round) => round.state === "completed");
  const solved = rounds.reduce((sum, round) => sum + round.solved, 0);
  const total = rounds.reduce((sum, round) => sum + round.total, 0);

  return {
    team: { name: team.team_name, code: team.team_code },
    members: team.members.map((member) => ({
      id: member.id,
      name: member.name,
      isYou: member.is_you,
      presence: onlineIds.has(member.id) ? "online" : "offline",
    })),
    rounds,
    progress: { solved, total },
    currentMission: allComplete
      ? {
          title: "Mission archived",
          summary: "Every operation is complete. Review the final transmission while results are processed.",
          actionLabel: "Review completed mission",
          href: "/round3",
        }
      : {
          title: currentRound.eyebrow,
          summary:
            currentRound.state === "active"
              ? currentRound.description
              : "Mission data is synchronized. Review the latest completed operation.",
          actionLabel: `${currentRound.solved > 0 ? "Continue" : "Begin"} ${currentRound.id === "master" ? "master terminal" : `round ${currentRound.index}`}`,
          href: currentRound.href,
        },
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamMeOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  const fetchTeam = useCallback(() => {
    getTeamMe()
      .then((nextTeam) => {
        setTeam(nextTeam);
        setError(null);
      })
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
          setOnlineIds((current) => new Set(current).add(event.user_id as string));
        } else if (event.type === "member_offline" && typeof event.user_id === "string") {
          setOnlineIds((current) => {
            const next = new Set(current);
            next.delete(event.user_id as string);
            return next;
          });
        }
        if (REFETCH_EVENTS.has(event.type)) fetchTeam();
      },
      [fetchTeam],
    ),
  );

  function handleLogout() {
    logout();
    router.push("/");
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p role="alert" className="border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono-data text-sm text-destructive">
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

  return (
    <DashboardView
      model={toDashboardViewModel(team, onlineIds)}
      onNavigate={(href) => router.push(href)}
      onLogout={handleLogout}
    />
  );
}
