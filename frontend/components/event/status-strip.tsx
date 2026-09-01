import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const statusStripVariants = cva(
  "font-mono-data flex items-center gap-2 border-y px-3 py-2 text-xs uppercase tracking-[0.12em]",
  {
    variants: {
      status: {
        online: "border-primary/35 bg-primary/[0.06] text-primary",
        neutral: "border-border bg-muted/40 text-muted-foreground",
        warning: "border-[var(--event-warning)]/40 bg-[var(--event-warning)]/[0.06] text-[var(--event-warning)]",
        error: "border-destructive/40 bg-destructive/[0.06] text-destructive",
      },
    },
    defaultVariants: { status: "neutral" },
  }
)

type StatusStripProps = React.ComponentProps<"div"> &
  VariantProps<typeof statusStripVariants>

function StatusStrip({ className, status = "neutral", children, ...props }: StatusStripProps) {
  return (
    <div
      role="status"
      data-slot="status-strip"
      data-status={status}
      className={cn(statusStripVariants({ status }), className)}
      {...props}
    >
      <span aria-hidden="true">●</span>
      <span>{children}</span>
    </div>
  )
}

export { StatusStrip, statusStripVariants, type StatusStripProps }
