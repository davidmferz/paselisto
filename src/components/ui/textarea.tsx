import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-28 w-full rounded-[14px] border-[1.5px] border-line-strong bg-surface px-4 py-3 text-base text-ink outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-mango/60 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-no",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
