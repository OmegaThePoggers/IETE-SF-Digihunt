import { EventHeader } from "@/components/event/event-header";
import { EventPanel } from "@/components/event/event-panel";
import { EventShell } from "@/components/event/event-shell";
import { StatusStrip } from "@/components/event/status-strip";
import { Button } from "@/components/ui/button";
import type { Round1Clue, Round1ViewModel } from "./round1-types";

const CATEGORY_LABEL: Record<string, string> = {
  binary: "Binary",
  morse: "Morse",
  cryptography: "Cryptography",
  logic: "Logic",
  cybersecurity: "Cybersecurity",
};

type Round1ViewProps = {
  model: Round1ViewModel;
  onBack: () => void;
  onOpenGate: () => void;
  onOpen: (id: string) => void;
  onClaim: (id: string) => void;
  onSelect: (answer: string) => void;
  onSubmit: () => void;
  onRelease: () => void;
};

function labelCategory(clue: Round1Clue) {
  return CATEGORY_LABEL[clue.category] ?? clue.category;
}

function clueStatusLabel(clue: Round1Clue, mine: boolean) {
  if (clue.status === "solved") return "Solved";
  if (clue.status === "available") return "Available";
  return mine ? "Open" : `Held by ${clue.claimedByName ?? "team"}`;
}

export function Round1View({ model, onBack, onOpenGate, onOpen, onClaim, onSelect, onSubmit, onRelease }: Round1ViewProps) {
  const current = model.currentIndex >= 0 ? model.clues[model.currentIndex] : null;
  const solved = model.clues.filter((clue) => clue.status === "solved").length;
  const total = model.clues.length;
  const blocked = model.state === "loading" || model.state === "locked" || model.state === "teammate-claimed" || model.state === "available";

  return (
    <EventShell>
      <EventHeader
        eyebrow="Round 1 // The Digital Trail"
        title="Clue workspace"
        description="Click any clue to inspect it. Use the dedicated claim button inside the workspace when you are ready to own it."
        actions={<Button variant="outline" onClick={onBack}>Mission control</Button>}
      />

      <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="font-mono-data text-xs tracking-[0.16em] text-muted-foreground uppercase">Clue sequence</p>
              <p className="font-mono-data text-xs text-muted-foreground">{solved}/{total} solved</p>
            </div>
            <ol aria-label="Clue sequence" data-slot="progress-rail" className="grid gap-px bg-border sm:grid-flow-col sm:auto-cols-fr">
              {model.clues.map((clue, index) => {
                const active = index === model.currentIndex;
                const mine = clue.status === "claimed" && clue.claimedByName === model.meName;
                const clickable = clue.status === "available" || mine;
                const actionLabel = mine ? "Open" : "View";
                const status = clue.status === "solved" ? "complete" : active ? "active" : "upcoming";
                const body = (
                  <>
                    <span aria-hidden="true" className="text-base">{clue.status === "solved" ? "✓" : String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0">
                      <span className="block">Clue {index + 1}</span>
                      <span className="block text-[10px] opacity-70">{clueStatusLabel(clue, mine)}</span>
                    </span>
                  </>
                );
                return (
                  <li key={clue.id} aria-current={active ? "step" : undefined} data-status={status} className="bg-background">
                    {clickable ? (
                      <button
                        type="button"
                        aria-label={`${actionLabel} clue ${index + 1}`}
                        disabled={model.busy}
                        onClick={() => onOpen(clue.id)}
                        className={`font-mono-data flex min-h-14 w-full items-center gap-3 px-3 py-3 text-left text-xs tracking-[0.12em] uppercase transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-wait ${active ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        {body}
                      </button>
                    ) : (
                      <div className={`font-mono-data flex min-h-14 items-center gap-3 px-3 py-3 text-xs tracking-[0.12em] uppercase ${active ? "bg-primary text-primary-foreground" : clue.status === "solved" ? "text-primary" : "text-muted-foreground"}`}>
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          <EventPanel variant={model.state === "complete" ? "emphasis" : model.state === "locked" ? "danger" : "default"} className="min-h-[26rem]">
            {model.state === "loading" ? (
              <p className="font-mono-data text-sm text-muted-foreground">LOADING THE DIGITAL TRAIL...</p>
            ) : model.state === "complete" ? (
              <div className="grid min-h-80 place-items-center text-center">
                <div>
                  <p className="font-mono-data mb-3 text-xs tracking-[0.2em] text-primary uppercase">Code fragments recovered</p>
                  <h2 className="font-heading mb-6 text-3xl font-bold uppercase">Trail complete</h2>
                  <p className="font-mono-data mb-2 text-[11px] tracking-widest text-muted-foreground uppercase">Cipher gate ready</p>
                  <p className="mb-5 text-sm text-muted-foreground">Unscramble your team-specific fragments in the Round {model.nextGateRound ?? 2} cipher gate to unlock the next round.</p>
                  <Button onClick={onOpenGate}>Open cipher gate</Button>
                </div>
              </div>
            ) : current ? (
              <div className="space-y-7">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
                  <p className="font-mono-data text-xs tracking-[0.18em] text-secondary uppercase">
                    Clue {model.currentIndex + 1} of {total} / {labelCategory(current)}
                  </p>
                  <p className="font-mono-data text-xs text-muted-foreground uppercase">{current.difficulty}</p>
                </div>

                <div>
                  <p className="mb-2 font-mono-data text-[11px] tracking-widest text-muted-foreground uppercase">Dominant clue</p>
                  <h2 className="font-heading text-2xl font-bold leading-tight text-foreground">{current.questionText}</h2>
                </div>

                {blocked ? null : (
                  <fieldset className="grid gap-3 sm:grid-cols-2" aria-label="Answer choices">
                    <legend className="sr-only">Answer choices</legend>
                    {current.options.map((option) => (
                      <label key={option} className={`cursor-pointer border px-4 py-3 font-mono-data text-sm ${model.selectedAnswer === option ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-secondary"}`}>
                        <input className="sr-only" type="radio" name="round1-answer" value={option} checked={model.selectedAnswer === option} onChange={() => onSelect(option)} />
                        <span aria-hidden="true">{model.selectedAnswer === option ? "▸ " : ""}</span>{option}
                      </label>
                    ))}
                  </fieldset>
                )}

                {model.feedback ? <StatusStrip aria-live="polite" status={model.feedback.tone === "error" ? "error" : model.feedback.tone === "success" ? "online" : "neutral"}>{model.feedback.message}</StatusStrip> : null}

                {model.state === "available" ? (
                  <Button disabled={model.busy} onClick={() => onClaim(current.id)}>
                    {model.busy ? "Claiming..." : "Claim this clue"}
                  </Button>
                ) : !blocked ? (
                  <div className="flex flex-wrap gap-2.5">
                    <Button disabled={model.busy || !model.selectedAnswer} onClick={onSubmit}>{model.busy ? "Submitting..." : "Submit"}</Button>
                    <Button variant="outline" disabled={model.busy} onClick={onRelease}>Release</Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </EventPanel>
        </div>

        <aside className="space-y-4">
          <StatusStrip status={model.state === "incorrect" || model.state === "locked" ? "error" : model.state === "complete" ? "online" : "neutral"}>
            {model.state === "teammate-claimed" && current?.claimedByName ? `Owned by ${current.claimedByName}` : model.state.replace("-", " ")}
          </StatusStrip>
          <EventPanel variant="muted">
            <h2 className="font-mono-data mb-4 text-xs tracking-[0.16em] uppercase text-muted-foreground">Recovered letters</h2>
            <div className="space-y-3">
              {model.clues.filter((clue) => clue.status === "solved").map((clue) => (
                <div key={clue.id} className="flex justify-between gap-3 border-b border-border pb-2 text-xs">
                  <span className="text-muted-foreground">{labelCategory(clue)}</span>
                  <span className="font-mono-data text-primary">{clue.codeFragment}</span>
                </div>
              ))}
              {solved === 0 ? <p className="text-sm text-muted-foreground">No fragments recovered yet.</p> : null}
            </div>
          </EventPanel>
        </aside>
      </div>
    </EventShell>
  );
}
