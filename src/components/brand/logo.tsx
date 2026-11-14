import { cn } from "cn"

function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <span aria-hidden className="size-[26px] rounded-[8px] bg-mango" />
      <span className="font-display text-[20px] leading-none font-bold">PaseListo</span>
    </span>
  )
}

export { Logo }
