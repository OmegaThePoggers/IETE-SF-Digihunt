"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  getAdminTeams,
  getStoredToken,
  redirectOnAdminError,
  type AdminTeamListItem,
} from "@/lib/api";

function ProgressBar({ solved, total }: { solved: number; total: number }) {
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono-data text-xs text-muted-foreground">
        {solved}/{total}
      </span>
    </div>
  );
}

// Card view for narrow screens — replaces forcing a horizontal-scroll table.
function TeamCard({ t, onOpen }: { t: AdminTeamListItem; onOpen: () => void }) {
  return (
    <div
      className="cursor-pointer border border-border p-4 transition-colors hover:border-secondary"
      onClick={onOpen}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-mono-data text-sm text-secondary">{t.team_code}</span>
        <Badge variant={t.status === "active" ? undefined : "destructive"} className="text-[9px]">
          {t.status.toUpperCase()}
        </Badge>
      </div>
      <p className="mb-3 font-mono-data text-sm text-foreground">{t.team_name}</p>
      <div className="grid grid-cols-2 gap-y-2 font-mono-data text-xs text-muted-foreground">
        <span>R1 {t.round1.solved}/{t.round1.total}</span>
        <span>R2 {t.round2.solved}/{t.round2.total}</span>
        <span>{t.round3_case ?? "No case"}</span>
        <span className={t.submitted ? "text-primary" : ""}>
          {t.submitted ? "Submitted" : "Not submitted"}
        </span>
      </div>
    </div>
  );
}

export default function AdminTeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<AdminTeamListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    getAdminTeams()
      .then(setTeams)
      .catch((err) => {
        const msg = redirectOnAdminError(err, router);
        if (msg) setError(msg);
      });
  }, [router]);

  if (error) {
    return (
      <p className="border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono-data text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!teams) {
    return (
      <p className="font-mono-data text-sm text-muted-foreground">LOADING TEAMS...</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="glow-cyan font-mono-data text-2xl font-bold text-primary">
        TEAMS ({teams.length})
      </h1>

      {/* narrow screens: cards */}
      <div className="grid gap-3 md:hidden">
        {teams.map((t) => (
          <TeamCard key={t.id} t={t} onOpen={() => router.push(`/admin/teams/${t.id}`)} />
        ))}
      </div>

      {/* md+: table, no forced min-width / horizontal scroll */}
      <div className="hidden border border-border md:block">
        <table className="w-full text-left font-mono-data text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Round 1</th>
              <th className="px-4 py-3">Round 2</th>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr
                key={t.id}
                className="cursor-pointer border-b border-border/50 hover:bg-muted/40"
                onClick={() => router.push(`/admin/teams/${t.id}`)}
              >
                <td className="px-4 py-3 text-secondary">{t.team_code}</td>
                <td className="px-4 py-3">{t.team_name}</td>
                <td className="px-4 py-3">
                  <Badge variant={t.status === "active" ? undefined : "destructive"}>
                    {t.status.toUpperCase()}
                  </Badge>
                </td>
                <td className="px-4 py-3">{t.member_count}</td>
                <td className="px-4 py-3">
                  <ProgressBar solved={t.round1.solved} total={t.round1.total} />
                </td>
                <td className="px-4 py-3">
                  <ProgressBar solved={t.round2.solved} total={t.round2.total} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {t.round3_case ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {t.submitted ? <Badge>YES</Badge> : <Badge variant="outline">NO</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
