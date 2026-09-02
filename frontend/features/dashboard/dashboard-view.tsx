import { ArrowRight, Check, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DashboardRound, DashboardViewModel } from "./dashboard-fixtures";

type DashboardViewProps = {
  model: DashboardViewModel;
  onNavigate: (href: string) => void;
  onLogout: () => void;
};

const stateLabels = {
  locked: "Locked",
  active: "Active",
  completed: "Completed",
} as const;

function RoundState({ round }: { round: DashboardRound }) {
  const label = stateLabels[round.state];
  return (
    <span
      className={`font-mono-data inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] uppercase ${
        round.state === "active"
          ? "text-primary"
          : round.state === "completed"
            ? "text-foreground"
            : "text-muted-foreground"
      }`}
    >
      {round.state === "completed" ? <Check aria-hidden="true" className="size-3.5" /> : null}
      {round.state === "locked" ? <Lock aria-hidden="true" className="size-3" /> : null}
      {label}
    </span>
  );
}

function RoundProgress({ round }: { round: DashboardRound }) {
  const isFinalSubmission = round.id === "round3";
  const total = isFinalSubmission ? 1 : round.total;
  const solved = isFinalSubmission && round.state === "completed" ? 1 : round.solved;
  const percentage = total > 0 ? Math.round((solved / total) * 100) : 0;

  return (
    <div className="mt-5 max-w-xl" data-stage-progress={round.id}>
      <div className="mb-2 flex items-center justify-between font-mono-data text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        <span>Stage progress</span>
        <span>{percentage}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={`Round ${round.index} progress`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={solved}
        className="h-1.5 overflow-hidden bg-border"
      >
        <span
          className={`block h-full transition-[width] ${round.state === "locked" ? "bg-muted-foreground/35" : "bg-primary"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function DashboardView({ model, onNavigate, onLogout }: DashboardViewProps) {
  const onlineCount = model.members.filter((member) => member.presence === "online").length;

  return (
    <main className="min-h-screen overflow-hidden">
      <header className="page-gutter flex min-h-20 items-center justify-between gap-5 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="pixel-marker" aria-hidden="true" />
          <span className="text-sm font-bold tracking-[0.12em] uppercase">DigiHunt / Mission Control</span>
        </div>
        <Button variant="quiet" onClick={onLogout}>Logout</Button>
      </header>

      <div className="page-gutter mx-auto grid w-full max-w-[1440px] gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-20 lg:py-16">
        <div className="min-w-0">
          <section aria-labelledby="mission-heading" className="border-t border-primary pt-5">
            <p className="font-mono-data mb-6 text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
              Current directive / {model.progress.solved} of {model.progress.total} objectives complete
            </p>
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div>
                <h1 id="mission-heading" className="max-w-3xl text-5xl leading-[0.9] font-bold uppercase sm:text-7xl lg:text-[6.5rem]">
                  {model.currentMission.title}
                </h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-secondary">
                  {model.currentMission.summary}
                </p>
              </div>
              <Button
                size="lg"
                data-prominent-action="true"
                className="h-14 px-5 md:min-w-56"
                onClick={() => onNavigate(model.currentMission.href)}
              >
                {model.currentMission.actionLabel}
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </section>

          <section aria-labelledby="progress-heading" className="mt-16 sm:mt-24">
            <div className="flex items-end justify-between gap-6 border-b border-border pb-4">
              <div>
                <p className="font-mono-data text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Operation sequence</p>
                <h2 id="progress-heading" className="mt-2 text-2xl font-bold uppercase sm:text-3xl">Mission progression</h2>
              </div>
              <p className="font-mono-data hidden text-xs text-muted-foreground sm:block">
                {model.progress.solved} of {model.progress.total} objectives complete
              </p>
            </div>

            <ol aria-label="Mission progression" data-layout="connected-progression" className="relative">
              {model.rounds.map((round, index) => {
                const isActive = round.state === "active";
                return (
                  <li
                    key={round.id}
                    aria-label={`Round ${round.index}, ${stateLabels[round.state]}`}
                    aria-current={isActive ? "step" : undefined}
                    data-state={round.state}
                    className="relative grid grid-cols-[4.5rem_minmax(0,1fr)] gap-5 border-b border-border py-8 sm:grid-cols-[7rem_minmax(0,1fr)_9rem] sm:gap-8 sm:py-10"
                  >
                    {index < model.rounds.length - 1 ? (
                      <span className="absolute top-[5.75rem] bottom-[-2rem] left-[2.2rem] w-px bg-border sm:top-[8rem] sm:bottom-[-2.5rem] sm:left-[3.45rem]" aria-hidden="true" />
                    ) : null}
                    <div className="relative flex items-start justify-center">
                      {isActive ? <span className="absolute top-1 -left-1 h-5 w-1 bg-primary sm:left-1" aria-hidden="true" /> : null}
                      <span
                        aria-hidden="true"
                        className={`text-5xl leading-none font-bold sm:text-7xl ${isActive ? "text-primary" : round.state === "locked" ? "text-muted-foreground/35" : "text-foreground"}`}
                      >
                        {round.index}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                        <p className="font-mono-data text-[10px] tracking-[0.18em] text-muted-foreground uppercase">{round.eyebrow}</p>
                        <RoundState round={round} />
                      </div>
                      <h3 className={`text-2xl font-bold uppercase sm:text-3xl ${round.state === "locked" ? "text-muted-foreground" : "text-foreground"}`}>
                        {round.title}
                      </h3>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{round.description}</p>
                      {round.id !== "master" ? <RoundProgress round={round} /> : null}
                    </div>
                    <div className="col-start-2 self-end sm:col-start-3 sm:text-right">
                      <p className="font-mono-data text-[11px] text-muted-foreground">
                        {round.total > 0 ? `${round.solved} / ${round.total} solved` : "Gate controlled"}
                      </p>
                      {round.state !== "locked" ? (
                        <Button
                          variant="quiet"
                          size="sm"
                          className="mt-2"
                          onClick={() => onNavigate(round.href)}
                        >
                          {round.state === "completed" ? `Review round ${round.index}` : `Open round ${round.index}`}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className="border-t border-border pt-5 lg:mt-40" aria-label="Team presence">
          <p className="font-mono-data text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Team channel</p>
          <h2 className="mt-3 text-2xl font-bold uppercase">{model.team.name}</h2>
          <div className="mt-5 flex items-center justify-between border-y border-border py-4">
            <span className="font-mono-data text-xs text-muted-foreground">{model.team.code}</span>
            <span className="font-mono-data text-xs text-primary">{onlineCount} / {model.members.length} online</span>
          </div>
          <ul className="divide-y divide-border">
            {model.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-4 py-4">
                <span className="text-sm font-bold">{member.name}</span>
                <span className={`font-mono-data text-[10px] tracking-wider uppercase ${member.presence === "online" ? "text-primary" : "text-muted-foreground"}`}>
                  {member.isYou ? `You · ${member.presence}` : member.presence === "online" ? "Online" : "Offline"}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
