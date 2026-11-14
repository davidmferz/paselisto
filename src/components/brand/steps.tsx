import { Check } from "lucide-react"
import { cn } from "cn"

type StepsProps = {
  steps: string[]
  /** 0-based index of the current step. */
  current: number
  className?: string
}

function Steps({ steps, current, className }: StepsProps) {
  return (
    <ol className={cn("flex items-center gap-2", className)} aria-label="Progreso">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "now" : "next"
        return (
          <li
            key={label}
            aria-current={state === "now" ? "step" : undefined}
            className="flex flex-1 items-center gap-2 last:flex-none"
          >
            <span
              className={cn(
                "font-data flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                state === "done" && "bg-ink text-on-ink",
                state === "now" && "bg-mango text-ink",
                state === "next" && "bg-sunken text-muted-foreground"
              )}
            >
              {state === "done" ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cn("text-label", state === "next" ? "text-muted-foreground" : "text-ink")}>
              {label}
            </span>
            {i < steps.length - 1 && <span aria-hidden className="h-px flex-1 bg-line" />}
          </li>
        )
      })}
    </ol>
  )
}

export { Steps }
export type { StepsProps }
