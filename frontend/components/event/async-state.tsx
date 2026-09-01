import * as React from "react"

import { cn } from "@/lib/utils"

type AsyncStateProps = React.ComponentProps<"div"> & {
  title: React.ReactNode
  description?: React.ReactNode
  indicator?: React.ReactNode
}

function AsyncState({
  title,
  description,
  indicator = "//",
  className,
  ...props
}: AsyncStateProps) {
  return (
    <div
      role="status"
      data-slot="async-state"
      className={cn("flex items-start gap-3 border border-border p-4", className)}
      {...props}
    >
      <span className="font-mono-data text-sm text-primary" aria-hidden="true">
        {indicator}
      </span>
      <div>
        <p className="font-bold uppercase tracking-[0.08em]">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  )
}

export { AsyncState, type AsyncStateProps }
