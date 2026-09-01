import * as React from "react"

import { cn } from "@/lib/utils"

function EventShell({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="event-shell"
      className={cn(
        "page-gutter mx-auto flex min-h-screen w-full max-w-[96rem] flex-col py-8 sm:py-12",
        className
      )}
      {...props}
    />
  )
}

export { EventShell }
