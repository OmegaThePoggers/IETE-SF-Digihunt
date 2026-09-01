import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const eventPanelVariants = cva("border p-4 sm:p-6", {
  variants: {
    variant: {
      default: "border-border bg-card text-card-foreground",
      emphasis: "border-primary/50 bg-primary/[0.06] text-foreground",
      muted: "border-border/70 bg-muted/50 text-foreground",
      danger: "border-destructive/60 bg-destructive/[0.07] text-foreground",
    },
  },
  defaultVariants: { variant: "default" },
})

type EventPanelProps = React.ComponentProps<"section"> &
  VariantProps<typeof eventPanelVariants>

function EventPanel({ className, variant = "default", ...props }: EventPanelProps) {
  return (
    <section
      data-slot="event-panel"
      data-variant={variant}
      className={cn(eventPanelVariants({ variant }), className)}
      {...props}
    />
  )
}

export { EventPanel, eventPanelVariants, type EventPanelProps }
