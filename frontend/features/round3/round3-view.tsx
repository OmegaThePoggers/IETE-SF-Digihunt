import { EventHeader } from "@/components/event/event-header";
import { EventPanel } from "@/components/event/event-panel";
import { EventShell } from "@/components/event/event-shell";
import { ProgressRail } from "@/components/event/progress-rail";
import { StatusStrip } from "@/components/event/status-strip";
import { Button } from "@/components/ui/button";
import type { Round3Question, Round3ViewModel } from "./round3-types";

export type Round3ViewProps = {
  model: Round3ViewModel;
  onBack: () => void;
  onBackToRound2: () => void;
  onOpenGate: () => void;
  onClaim: (id: string) => void;
  onSelect: (id: string, answer: string) => void;
  onSubmit: (id: string) => void;
  onRelease: (id: string) => void;
};

function QuestionCard({ q, mine, onClaim, onSelect, onSubmit, onRelease }: { q: Round3Question; mine: boolean } & Pick<Round3ViewProps, "onClaim" | "onSelect" | "onSubmit" | "onRelease">) {
  if (q.status === "solved") return <div className="flex justify-between border-l-2 border-border py-3 pl-4 text-sm opacity-60"><span>{q.label}</span><span className="font-mono-data text-primary">✓ {q.codeFragment ?? "SOLVED"}</span></div>;
  if (q.status === "claimed" && !mine) return <div className="flex justify-between border-l-2 border-border py-3 pl-4 text-sm opacity-60"><span>{q.label}</span><span className="font-mono-data text-muted-foreground">Being solved by {q.claimedByName ?? "a teammate"}</span></div>;
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

export function Round3View({ model, onBack, onBackToRound2, onOpenGate, onClaim, onSelect, onSubmit, onRelease }: Round3ViewProps) {
  if (model.state === "locked") return <main className="grid min-h-screen place-items-center bg-background px-6 text-center"><div><h1 className="font-heading text-3xl font-bold uppercase text-primary">Round locked</h1><p className="my-4 text-muted-foreground">Solve the Round 3 cipher gate to unlock this round.</p><Button variant="outline" onClick={onBackToRound2}>Back to Round 2</Button></div></main>;
  if (model.state === "loading") return <main className="grid min-h-screen place-items-center bg-background"><p className="font-mono-data text-sm text-muted-foreground">LOADING THE FINAL HACK...</p></main>;
  if (model.error) return <main className="grid min-h-screen place-items-center bg-background"><StatusStrip status="error">{model.error}</StatusStrip></main>;

  const solved = model.questions.filter((q) => q.status === "solved").length;

  return <EventShell>
    <EventHeader eyebrow="Round 3 // Defensive Prototyping" title={model.state === "complete" ? "Final hack cleared" : "Final hack"} description={model.state === "complete" ? "All defensive-prototyping checks are solved. Use the recovered fragments in the Round 4 cipher gate." : "Solve the final MCQ board. Each correct answer reveals one more fragment for your team cipher."} actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onBack}>Mission control</Button>{model.state === "complete" ? <Button onClick={onOpenGate}>Open cipher gate</Button> : null}</div>} />
    <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
      <section className="space-y-5">
        <EventPanel>
          <p className="mb-3 font-mono-data text-xs tracking-[0.16em] uppercase text-muted-foreground">Build brief</p>
          <h2 className="font-heading mb-3 text-2xl font-bold uppercase">The Final Hack</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Lock down the prototype before your team enters the final presentation upload. Focus on access control, secure coding, monitoring, incident response, and crypto hygiene.</p>
        </EventPanel>
        <EventPanel variant="muted"><h2 className="font-mono-data mb-4 text-xs tracking-[0.16em] uppercase text-muted-foreground">Recovered fragments</h2><div className="space-y-3">{model.questions.filter((q) => q.status === "solved").map((q, index) => <div key={q.id} className="flex justify-between gap-3 border-b border-border pb-2 text-xs"><span className="text-muted-foreground">{index + 1}. {q.label}</span><span className="font-mono-data text-primary">{q.codeFragment}</span></div>)}{solved === 0 ? <p className="text-sm text-muted-foreground">No fragments recovered yet.</p> : null}</div></EventPanel>
      </section>
      <section className="space-y-5">
        <ProgressRail aria-label="Progress trail" steps={model.questions.map((q) => ({ id: q.id, label: q.label, status: q.status === "solved" ? "complete" : q.status === "claimed" ? "active" : "upcoming" }))} />
        <EventPanel><div className="mb-4 flex items-center justify-between"><p className="font-mono-data text-xs tracking-[0.16em] uppercase text-muted-foreground">Challenge questions</p><p className="font-mono-data text-xs text-muted-foreground">{solved}/{model.questions.length} solved</p></div><div className="space-y-2">{model.questions.map((q) => <QuestionCard key={q.id} q={q} mine={q.claimedByName === model.meName} onClaim={onClaim} onSelect={onSelect} onSubmit={onSubmit} onRelease={onRelease} />)}</div></EventPanel>
      </section>
    </div>
  </EventShell>;
}
