import * as React from "react"

import { cn } from "@/lib/utils"

type ProgressStep = {
  id: string
  label: React.ReactNode
  status?: "complete" | "active" | "upcoming"
}

type ProgressRailProps = Omit<React.ComponentProps<"ol">, "children"> & {
  steps: ProgressStep[]
}

function ProgressRail({ steps, className, ...props }: ProgressRailProps) {
  return (
    <ol
      data-slot="progress-rail"
      className={cn("grid gap-px bg-border sm:grid-flow-col sm:auto-cols-fr", className)}
      {...props}
    >
      {steps.map((step, index) => {
        const status = step.status ?? "upcoming"
        return (
          <li
            key={step.id}
            aria-current={status === "active" ? "step" : undefined}
            data-status={status}
            className={cn(
              "font-mono-data flex items-center gap-3 bg-background px-3 py-3 text-xs uppercase tracking-[0.12em]",
              status === "active" && "bg-primary text-primary-foreground",
              status === "complete" && "text-primary",
              status === "upcoming" && "text-muted-foreground"
            )}
          >
            <span aria-hidden="true">{status === "complete" ? "✓" : String(index + 1).padStart(2, "0")}</span>
            <span>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export { ProgressRail, type ProgressRailProps, type ProgressStep }
