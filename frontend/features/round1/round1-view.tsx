import { EventHeader } from "@/components/event/event-header";
import { EventPanel } from "@/components/event/event-panel";
import { EventShell } from "@/components/event/event-shell";
import { ProgressRail } from "@/components/event/progress-rail";
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
  onSelect: (answer: string) => void;
  onSubmit: () => void;
  onRelease: () => void;
};

function labelCategory(clue: Round1Clue) {
  return CATEGORY_LABEL[clue.category] ?? clue.category;
}

export function Round1View({ model, onBack, onSelect, onSubmit, onRelease }: Round1ViewProps) {
  const current = model.currentIndex >= 0 ? model.clues[model.currentIndex] : null;
  const solved = model.clues.filter((clue) => clue.status === "solved").length;
  const total = model.clues.length;
  const blocked = model.state === "loading" || model.state === "locked" || model.state === "teammate-claimed" || model.state === "available";

  return (
    <EventShell>
      <EventHeader
        eyebrow="Round 1 // The Digital Trail"
        title="Clue workspace"
        description="Work through the sequence one clue at a time. Ownership is visible so teammates do not collide."
        actions={<Button variant="outline" onClick={onBack}>Mission control</Button>}
      />

      <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="font-mono-data text-xs tracking-[0.16em] text-muted-foreground uppercase">Clue sequence</p>
              <p className="font-mono-data text-xs text-muted-foreground">{solved}/{total} solved</p>
            </div>
            <ProgressRail
              aria-label="Clue sequence"
              steps={model.clues.map((clue, index) => ({
                id: clue.id,
                label: `Clue ${index + 1}`,
                status: clue.status === "solved" ? "complete" : index === model.currentIndex ? "active" : "upcoming",
              }))}
            />
          </div>

          <EventPanel variant={model.state === "complete" ? "emphasis" : model.state === "locked" ? "danger" : "default"} className="min-h-[26rem]">
            {model.state === "loading" ? (
              <p className="font-mono-data text-sm text-muted-foreground">LOADING THE DIGITAL TRAIL...</p>
            ) : model.state === "complete" ? (
              <div className="grid min-h-80 place-items-center text-center">
                <div>
                  <p className="font-mono-data mb-3 text-xs tracking-[0.2em] text-primary uppercase">Code fragments recovered</p>
                  <h2 className="font-heading mb-6 text-3xl font-bold uppercase">Trail complete</h2>
                  <p className="font-mono-data mb-2 text-[11px] tracking-widest text-muted-foreground uppercase">Access key</p>
                  <p className="glow-lime font-mono-data break-all text-3xl font-bold tracking-widest text-secondary">{model.accessKey}</p>
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

                {!blocked ? (
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
            <h2 className="font-mono-data mb-4 text-xs tracking-[0.16em] uppercase text-muted-foreground">Recovered fragments</h2>
            <div className="space-y-3">
              {model.clues.filter((clue) => clue.status === "solved").map((clue, index) => (
                <div key={clue.id} className="flex justify-between gap-3 border-b border-border pb-2 text-xs">
                  <span className="text-muted-foreground">{index + 1}. {labelCategory(clue)}</span>
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
