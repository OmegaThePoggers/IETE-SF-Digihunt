import * as React from "react"

import { cn } from "@/lib/utils"

type SectionMarkerProps = React.ComponentProps<"div"> & {
  index: React.ReactNode
  label: React.ReactNode
  headingLevel?: 2 | 3 | 4 | 5 | 6
}

function SectionMarker({
  index,
  label,
  headingLevel = 2,
  className,
  ...props
}: SectionMarkerProps) {
  const Heading = `h${headingLevel}` as const

  return (
    <div
      data-slot="section-marker"
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-5",
        className
      )}
      {...props}
    >
      <span className="font-mono-data text-xs font-bold text-primary" aria-hidden="true">
        {index}
      </span>
      <div className="flex min-w-0 items-center gap-3">
        <Heading className="shrink-0 text-sm font-bold uppercase tracking-[0.16em]">
          {label}
        </Heading>
        <span className="hard-rule" aria-hidden="true" />
      </div>
    </div>
  )
}

export { SectionMarker, type SectionMarkerProps }
