import { EventHeader } from "@/components/event/event-header";
import { EventPanel } from "@/components/event/event-panel";
import { EventShell } from "@/components/event/event-shell";
import { StatusStrip } from "@/components/event/status-strip";
import { Button } from "@/components/ui/button";
import type { GateViewModel } from "./gate-types";

export type GateViewProps = {
  model: GateViewModel;
  onChangeKey: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

export function GateView({ model, onChangeKey, onSubmit, onBack }: GateViewProps) {
  if (model.state === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <p className="font-mono-data text-sm text-muted-foreground">ESTABLISHING SECURE CONNECTION...</p>
      </main>
    );
  }

  return (
    <EventShell>
      <EventHeader
        eyebrow={`Cipher gate // Round ${model.sourceRound} → Round ${model.roundNumber}`}
        title={model.state === "unlocked" ? "Access granted" : "Cipher gate"}
        description={
          model.state === "unlocked"
            ? `Round ${model.roundNumber} is now unlocked.`
            : `Solve Round ${model.sourceRound} to recover the letters, then solve the themed anagram below.`
        }
        actions={
          <Button variant="outline" onClick={onBack}>
            Mission control
          </Button>
        }
      />

      <div className="py-8">
        {model.state === "locked" ? (
          <EventPanel variant="muted">
            <p className="font-mono-data text-sm text-muted-foreground">
              Finish Round {model.sourceRound} to receive the cipher key.
            </p>
          </EventPanel>
        ) : null}

        {model.state === "unlocked" ? (
          <EventPanel variant="emphasis">
            <p className="mb-4 font-heading text-2xl font-bold uppercase text-primary">Round unlocked</p>
            <p className="mb-6 text-sm text-muted-foreground">{model.message}</p>
            <Button onClick={onBack}>Enter Round {model.roundNumber}</Button>
          </EventPanel>
        ) : null}

        {model.state === "ready" || model.state === "submitting" || model.state === "rejected" ? (
          <EventPanel>
            <p className="mb-4 font-mono-data text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Review Round {model.sourceRound} to collect the recovered letters.
            </p>

            {model.wordLengths.length > 0 ? (
              <p className="mb-4 font-mono-data text-xs uppercase tracking-[0.2em] text-muted-foreground">Answer shape · <span className="text-primary">{model.wordLengths.join(" · ")}</span></p>
            ) : null}

            {model.hint ? (
              <p className="mb-6 border-l-2 border-secondary pl-4 text-sm leading-6 text-muted-foreground">{model.hint}</p>
            ) : null}

            <label htmlFor="gate-key-input" className="mb-2 block font-mono-data text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Unscrambled key
            </label>
            <input
              id="gate-key-input"
              type="text"
              autoComplete="off"
              value={model.answer}
              onChange={(e) => onChangeKey(e.target.value)}
              className="mb-4 w-full border border-border bg-transparent px-4 py-3 font-mono-data text-lg uppercase tracking-widest text-foreground outline-none focus:border-primary"
            />

            {model.state === "rejected" ? (
              <StatusStrip status="error">
                {model.message} · attempt {model.attempts}
              </StatusStrip>
            ) : null}

            <Button
              className="mt-4"
              disabled={model.state === "submitting" || !model.answer.trim()}
              onClick={onSubmit}
            >
              {model.state === "submitting" ? "Verifying..." : `Unlock Round ${model.roundNumber}`}
            </Button>
          </EventPanel>
        ) : null}
      </div>
    </EventShell>
  );
}
