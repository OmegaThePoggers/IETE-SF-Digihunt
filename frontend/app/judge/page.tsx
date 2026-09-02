"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAssignedTeams, redirectOnJudgeError, type AssignedTeamOut } from "@/lib/api";

export default function JudgePage() {
  const router = useRouter();
  const [teams, setTeams] = useState<AssignedTeamOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAssignedTeams()
      .then(setTeams)
      .catch((err) => {
        const msg = redirectOnJudgeError(err, router);
        if (msg) setError(msg);
      });
  }, [router]);

  if (error) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono-data text-sm text-destructive">
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
    <div className="flex flex-col gap-8">
      <h1 className="glow-cyan font-mono-data text-2xl font-bold text-primary">
        TEAMS TO JUDGE
      </h1>
      {teams.length === 0 ? (
        <p className="font-mono-data text-sm text-muted-foreground">
          No teams have submitted yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((t) => (
            <Card
              key={t.team_id}
              className="glow-border cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => router.push(`/judge/teams/${t.team_id}`)}
            >
              <CardHeader>
                <CardTitle className="font-mono-data text-lg text-primary">
                  {t.team_code}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 font-mono-data text-sm text-foreground">
                <p className="text-muted-foreground">
                  Case: {t.case ? `#${t.case.case_number} · ${t.case.title}` : "Not assigned"}
                </p>
                <p className="text-muted-foreground">
                  Stages: {t.round1_complete ? "✓ R1" : "○ R1"} · {t.round2_complete ? "✓ R2" : "○ R2"} · {t.round3_submitted ? "✓ R3" : "○ R3"}
                </p>
                <p className="text-muted-foreground">
                  Submission: {t.submission ? `${t.submission.file_name} (${new Date(t.submission.submitted_at).toLocaleString()})` : "Not submitted"}
                </p>
                <div>
                  {t.my_score === null ? (
                    <Badge variant="outline">NOT SCORED</Badge>
                  ) : t.my_score.finalized ? (
                    <Badge>FINALIZED · {t.my_score.total}/60</Badge>
                  ) : (
                    <Badge variant="outline">DRAFT · {t.my_score.total}/60</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
