import { EventHeader } from "@/components/event/event-header";
import { EventPanel } from "@/components/event/event-panel";
import { EventShell } from "@/components/event/event-shell";
import { ProgressRail } from "@/components/event/progress-rail";
import { StatusStrip } from "@/components/event/status-strip";
import { Button } from "@/components/ui/button";
import type { Round2EvidenceId, Round2Question, Round2ViewModel } from "./round2-types";

const evidenceTabs: { id: Round2EvidenceId; label: string }[] = [
  { id: "log", label: "Server log" },
  { id: "email", label: "Suspicious email" },
  { id: "code", label: "Code snippet" },
  { id: "timeline", label: "Timeline" },
];

export type Round2ViewProps = {
  model: Round2ViewModel;
  onBack: () => void;
  onBackToRound1: () => void;
  onEvidenceTabChange: (tab: Round2EvidenceId) => void;
  onClaim: (id: string) => void;
  onSelect: (id: string, answer: string) => void;
  onSubmit: (id: string) => void;
  onRelease: (id: string) => void;
};

function QuestionCard({ q, mine, onClaim, onSelect, onSubmit, onRelease }: { q: Round2Question; mine: boolean } & Pick<Round2ViewProps, "onClaim" | "onSelect" | "onSubmit" | "onRelease">) {
  if (q.status === "solved") return <div className="flex justify-between border-l-2 border-border py-3 pl-4 text-sm opacity-60"><span>{q.label}</span><span className="font-mono-data text-primary">✓ SOLVED</span></div>;
  if (q.status === "claimed" && !mine) return <div className="flex justify-between border-l-2 border-border py-3 pl-4 text-sm opacity-60"><span>{q.label}</span><span className="font-mono-data text-muted-foreground">Being investigated by {q.claimedByName ?? "a teammate"}</span></div>;
  if (q.status === "available") return <button type="button" className="flex w-full justify-between border-l-2 border-border py-3 pl-4 text-left text-sm hover:border-secondary" onClick={() => onClaim(q.id)} disabled={q.busy}><span>{q.label} · {q.difficulty}</span><span className="font-mono-data">Claim {q.label}</span></button>;

  return <div className="border-l-2 border-primary bg-primary/[0.03] p-4">
    <div className="mb-4 flex justify-between gap-3"><p className="font-mono-data text-xs text-primary">{q.label} · {q.difficulty}</p><span className="font-mono-data text-xs">CLAIMED BY YOU</span></div>
    <h3 className="mb-4 font-heading text-xl font-bold">{q.questionText}</h3>
    <fieldset className="grid gap-2 sm:grid-cols-2" aria-label={`${q.label} answer choices`}>
      {q.options.map((option) => <label key={option} className={`cursor-pointer border px-3 py-2 text-sm ${q.selectedAnswer === option ? "border-primary bg-primary/10 text-primary" : "border-border"}`}><input className="sr-only" type="radio" name={`answer-${q.id}`} checked={q.selectedAnswer === option} onChange={() => onSelect(q.id, option)} />{option}</label>)}
    </fieldset>
    {q.feedback ? <StatusStrip status={q.feedback.correct ? "online" : "error"}>ACCESS {q.feedback.correct ? "GRANTED" : "DENIED"} — {q.feedback.message}</StatusStrip> : null}
    <div className="mt-4 flex gap-2"><Button disabled={q.busy || !q.selectedAnswer} onClick={() => onSubmit(q.id)}>Submit</Button><Button variant="outline" disabled={q.busy} onClick={() => onRelease(q.id)}>Release</Button></div>
  </div>;
}

export function Round2View({ model, onBack, onBackToRound1, onEvidenceTabChange, onClaim, onSelect, onSubmit, onRelease }: Round2ViewProps) {
  if (model.state === "locked") return <main className="grid min-h-screen place-items-center bg-background px-6 text-center"><div><h1 className="font-heading text-3xl font-bold uppercase text-primary">Round locked</h1><p className="my-4 text-muted-foreground">Complete the previous mission objective to unlock this round.</p><Button variant="outline" onClick={onBackToRound1}>Back to Round 1</Button></div></main>;
  if (model.state === "loading") return <main className="grid min-h-screen place-items-center bg-background"><p className="font-mono-data text-sm text-muted-foreground">LOADING THE CASE FILE...</p></main>;
  if (model.error) return <main className="grid min-h-screen place-items-center bg-background"><StatusStrip status="error">{model.error}</StatusStrip></main>;

  const solved = model.questions.filter((q) => q.status === "solved").length;
  const active = model.evidence;

  return <EventShell>
    <EventHeader eyebrow="Round 2 // Digital Detectives" title={model.state === "complete" ? "Complete dossier" : "Incident dossier"} description="Correlate evidence, claim investigation questions, and build the final incident summary." actions={<Button variant="outline" onClick={onBack}>Mission control</Button>} />
    <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
      <section className="space-y-5">
        <EventPanel>
          <div className="mb-4 flex items-center justify-between"><p className="font-mono-data text-xs tracking-[0.16em] uppercase text-muted-foreground">Evidence index</p><p className="font-mono-data text-xs text-muted-foreground">{solved}/{model.questions.length} solved</p></div>
          <div role="tablist" aria-label="Evidence index" className="mb-4 flex flex-wrap gap-2">{evidenceTabs.map((tab) => <button key={tab.id} role="tab" aria-selected={model.activeEvidenceId === tab.id} className={`border px-3 py-2 text-sm ${model.activeEvidenceId === tab.id ? "border-primary text-primary" : "border-border"}`} onClick={() => onEvidenceTabChange(tab.id)}>{tab.label}</button>)}</div>
          <div role="region" aria-label="Active evidence" className="min-h-72 border border-border bg-black/20 p-4">
            {!active ? <p className="font-mono-data text-sm text-muted-foreground">LOADING EVIDENCE...</p> : model.activeEvidenceId === "log" ? <div className="max-h-72 overflow-y-auto font-mono-data text-xs">{active.serverLog.map((line) => <p key={`${line.time}-${line.event}`}><span className="text-muted-foreground">[{line.time}]</span> {line.event}</p>)}</div> : model.activeEvidenceId === "email" ? <div className="space-y-2 text-sm"><p><span className="font-mono-data text-muted-foreground">From:</span> {active.suspiciousEmail.from}</p><p><span className="font-mono-data text-muted-foreground">Subject:</span> {active.suspiciousEmail.subject}</p><p>{active.suspiciousEmail.body}</p><p className="border-t border-border pt-3">{active.userActivity}</p></div> : model.activeEvidenceId === "code" ? <pre className="overflow-x-auto whitespace-pre-wrap font-mono-data text-xs text-primary">{active.codeSnippet}</pre> : <p className="font-mono-data text-xs leading-relaxed">{active.timeline}</p>}
          </div>
        </EventPanel>
      </section>
      <section className="space-y-5">
        <ProgressRail aria-label="Progress trail" steps={model.questions.map((q) => ({ id: q.id, label: q.label, status: q.status === "solved" ? "complete" : q.status === "claimed" ? "active" : "upcoming" }))} />
        {model.state === "complete" && model.summary ? <EventPanel><h2 className="font-heading mb-4 text-2xl font-bold uppercase">Investigation summary</h2><div className="grid gap-2 sm:grid-cols-2">{Object.entries(model.summary).map(([k, v]) => <p key={k}><span className="font-mono-data text-secondary">{k.toUpperCase()}:</span> {v}</p>)}</div></EventPanel> : null}
        <EventPanel><p className="mb-4 font-mono-data text-xs tracking-[0.16em] uppercase text-muted-foreground">Investigation questions</p><div className="space-y-2">{model.questions.map((q) => <QuestionCard key={q.id} q={q} mine={q.claimedByName === model.meName} onClaim={onClaim} onSelect={onSelect} onSubmit={onSubmit} onRelease={onRelease} />)}</div></EventPanel>
      </section>
    </div>
  </EventShell>;
}
