import * as React from "react";

import { BrandMark } from "@/components/event/brand-mark";
import { EventShell } from "@/components/event/event-shell";
import { cn } from "@/lib/utils";

type AccessShellProps = {
  mode: "login" | "register";
  workspaceLabel: string;
  children: React.ReactNode;
  className?: string;
};

function AccessShell({ mode, workspaceLabel, children, className }: AccessShellProps) {
  return (
    <EventShell className={cn("justify-center", className)}>
      <div className="grid min-h-[calc(100vh-4rem)] border border-border bg-background lg:grid-cols-12 sm:min-h-[calc(100vh-6rem)]">
        <section
          aria-label="DigiHunt event identity"
          className="relative flex min-h-72 flex-col justify-between overflow-hidden border-b border-primary/40 bg-primary/[0.06] p-6 lg:col-span-5 lg:min-h-0 lg:border-r lg:border-b-0 lg:p-10"
        >
          <div className="flex items-center justify-between gap-4 font-mono-data text-xs uppercase tracking-[0.24em] text-primary">
            <BrandMark size="sm" textClassName="hidden sm:flex" />
            <span>{mode === "login" ? "Access" : "Enlist"}</span>
          </div>

          <div aria-hidden="true" className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-[0.07] blur-[0.2px] sm:-right-10 lg:-right-16">
            <BrandMark size="xl" showText={false} className="scale-[2.8] sm:scale-[3.8] lg:scale-[5]" />
          </div>

          <div className="relative max-w-md py-12 lg:py-20">
            <p className="font-mono-data mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Knowledge Hunt
            </p>
            <p className="font-heading text-6xl font-black uppercase leading-[0.78] tracking-[-0.07em] text-foreground sm:text-7xl lg:text-8xl">
              DIGI<br />HUNT
            </p>
            <div className="hard-rule hard-rule-strong my-6" />
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              Your team. One signal. Enter the event grid and trace the answer before the clock runs out.
            </p>
          </div>

          <p className="font-mono-data relative text-xs uppercase tracking-[0.2em] text-muted-foreground">
            IETE Students&apos; Forum
          </p>
        </section>

        <section
          aria-label={workspaceLabel}
          className="flex min-w-0 flex-col justify-center p-6 sm:p-10 lg:col-span-7 lg:p-14 xl:p-20"
        >
          <div className="w-full max-w-3xl">{children}</div>
        </section>
      </div>
    </EventShell>
  );
}

export { AccessShell, type AccessShellProps };
