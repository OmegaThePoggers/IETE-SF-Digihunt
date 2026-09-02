import * as React from "react"

import { BrandMark } from "@/components/event/brand-mark"
import { cn } from "@/lib/utils"

type EventHeaderProps = React.ComponentProps<"header"> & {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

function EventHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: EventHeaderProps) {
  return (
    <header
      data-slot="event-header"
      className={cn("border-b border-border pb-6 sm:pb-8", className)}
      {...props}
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <BrandMark size="sm" className="mb-5" />
          {eyebrow ? (
            <p className="font-mono-data mb-3 text-xs uppercase tracking-[0.24em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-heading text-4xl leading-[0.9] font-bold uppercase tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

export { EventHeader, type EventHeaderProps }
