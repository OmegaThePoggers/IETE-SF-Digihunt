"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  downloadJudgeSubmission,
  getJudgeTeamDetail,
  redirectOnJudgeError,
  submitScore,
  type TeamJudgingDetailOut,
} from "@/lib/api";

const inputClass =
  "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground font-mono-data outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

const CRITERIA = [
  { key: "problem_understanding", label: "Problem Understanding", max: 10 },
  { key: "technical_solution", label: "Technical Solution", max: 20 },
  { key: "creativity", label: "Creativity", max: 10 },
  { key: "presentation", label: "Presentation", max: 10 },
  { key: "feasibility", label: "Feasibility", max: 10 },
] as const;

type CriterionKey = (typeof CRITERIA)[number]["key"];

const MAX_TOTAL = CRITERIA.reduce((sum, c) => sum + c.max, 0);

export default function JudgeTeamDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const teamId = params.id;

  const [team, setTeam] = useState<TeamJudgingDetailOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [scores, setScores] = useState<Record<CriterionKey, number>>({
    problem_understanding: 0,
    technical_solution: 0,
    creativity: 0,
    presentation: 0,
    feasibility: 0,
  });
  const [comments, setComments] = useState("");

  const load = useCallback(() => {
    getJudgeTeamDetail(teamId)
      .then((data) => {
        setTeam(data);
        if (data.my_score) {
          setScores({
            problem_understanding: data.my_score.problem_understanding,
            technical_solution: data.my_score.technical_solution,
            creativity: data.my_score.creativity,
            presentation: data.my_score.presentation,
            feasibility: data.my_score.feasibility,
          });
          setComments(data.my_score.comments ?? "");
        }
      })
      .catch((err) => {
        const msg = redirectOnJudgeError(err, router);
        if (msg) setError(msg);
      });
  }, [teamId, router]);

  useEffect(() => {
    load();
  }, [load]);

  const finalized = team?.my_score?.finalized ?? false;
  const total = CRITERIA.reduce((sum, c) => sum + (scores[c.key] || 0), 0);

  async function handleSave(finalize: boolean) {
    setFormError(null);
    setSaving(true);
    try {
      await submitScore(teamId, { ...scores, comments: comments || null, finalize });
      load();
    } catch (err) {
      const msg = redirectOnJudgeError(err, router);
      if (msg) setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono-data text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!team) {
    return (
      <p className="font-mono-data text-sm text-muted-foreground">LOADING TEAM...</p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="glow-cyan font-mono-data text-2xl font-bold text-primary">
          {team.team_code}
        </h1>
        {finalized && <Badge>FINALIZED</Badge>}
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-mono-data text-sm text-secondary">CASE</CardTitle>
          </CardHeader>
          <CardContent className="font-mono-data text-sm text-foreground">
            {team.case ? `#${team.case.case_number} · ${team.case.title}` : "Not assigned"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-mono-data text-sm text-secondary">SUBMISSION</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 font-mono-data text-sm text-foreground">
            <span>
              {team.submission ? team.submission.file_name : "NO PRESENTATION SUBMITTED"}
              <br />
              {team.submission && <span className="text-xs text-muted-foreground">
                {new Date(team.submission.submitted_at).toLocaleString()}
              </span>}
            </span>
            {team.submission && <Button
              variant="outline"
              size="sm"
              className="font-mono-data"
              onClick={() => downloadJudgeSubmission(teamId, team.submission!.file_name)}
            >
              DOWNLOAD
            </Button>}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-mono-data text-sm tracking-widest text-primary">ROUND 2 MCQ SUMMARY</h2>
        <div className="grid gap-3">
          {team.round2_review.map((question) => (
            <Card key={question.team_question_id}>
              <CardContent className="flex flex-col gap-3 py-4 font-mono-data text-sm">
                <p className="text-primary">{question.category.toUpperCase()}</p>
                <p>{question.question_text}</p>
                <p>TEAM: {question.submitted_answer ?? "Awaiting answer"}</p>
                <p>ANSWER: {question.ideal_answer}</p>
                <p>STATUS: {question.submitted_answer === question.ideal_answer ? "SOLVED" : "PENDING"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {team.round2_investigation_summary && (
        <section>
          <h2 className="mb-3 font-mono-data text-sm tracking-widest text-primary">
            ROUND 2 INVESTIGATION SUMMARY
          </h2>
          <Card>
            <CardContent className="grid gap-2 py-4 sm:grid-cols-2">
              {Object.entries(team.round2_investigation_summary).map(([k, v]) => (
                <p key={k} className="font-mono-data text-sm text-foreground">
                  <span className="text-secondary">{k.toUpperCase()}:</span> {v}
                </p>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-mono-data text-sm tracking-widest text-primary">
          SCORECARD
        </h2>
        <Card className="glow-border">
          <CardContent className="flex flex-col gap-4 py-6">
            {CRITERIA.map((c) => (
              <div key={c.key} className="space-y-2">
                <label className="flex justify-between font-mono-data text-xs uppercase tracking-wide text-secondary">
                  <span>{c.label}</span>
                  <span>
                    {scores[c.key]} / {c.max}
                  </span>
                </label>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={c.max}
                  value={scores[c.key]}
                  disabled={finalized}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(c.max, Number(e.target.value) || 0));
                    setScores((s) => ({ ...s, [c.key]: v }));
                  }}
                />
              </div>
            ))}

            <div className="space-y-2">
              <label className="font-mono-data text-xs uppercase tracking-wide text-secondary">
                Comments
              </label>
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                value={comments}
                disabled={finalized}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>

            <p className="glow-cyan font-mono-data text-lg font-bold text-primary">
              TOTAL: {total} / {MAX_TOTAL}
            </p>

            {formError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono-data text-sm text-destructive">
                {formError}
              </p>
            )}

            {finalized ? (
              <p className="font-mono-data text-sm text-muted-foreground">
                This score is finalized and can no longer be edited.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="font-mono-data"
                  disabled={saving}
                  onClick={() => handleSave(false)}
                >
                  {saving ? "SAVING..." : "SAVE DRAFT"}
                </Button>
                <Button
                  className="glow-border font-mono-data"
                  disabled={saving}
                  onClick={() => handleSave(true)}
                >
                  {saving ? "SAVING..." : "FINALIZE"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
