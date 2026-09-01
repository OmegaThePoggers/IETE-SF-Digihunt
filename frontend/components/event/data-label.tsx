import * as React from "react"

import { cn } from "@/lib/utils"

type DataLabelProps = React.ComponentProps<"div"> & {
  label: React.ReactNode
  value: React.ReactNode
}

function DataLabel({ label, value, className, ...props }: DataLabelProps) {
  return (
    <div
      data-slot="data-label"
      className={cn("grid gap-1 border-l border-primary pl-3", className)}
      {...props}
    >
      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono-data text-sm text-foreground">{value}</span>
    </div>
  )
}

export { DataLabel, type DataLabelProps }
