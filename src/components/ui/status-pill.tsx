import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const pill = cva(
  "text-label inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
  {
    variants: {
      status: {
        pagado: "bg-ok-soft text-ok",
        pendiente: "bg-wait-soft text-wait",
        revision: "bg-no-soft text-no",
        usado: "bg-sunken text-muted-foreground",
      },
    },
    defaultVariants: { status: "pendiente" },
  }
)

const LABELS = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  revision: "En revisión",
  usado: "Usado",
} as const

type StatusPillProps = React.ComponentProps<"span"> &
  VariantProps<typeof pill> & { status: keyof typeof LABELS; label?: string }

function StatusPill({ status, label, className, ...props }: StatusPillProps) {
  return (
    <span data-slot="status-pill" className={cn(pill({ status }), className)} {...props}>
      <span aria-hidden className="size-2 rounded-full bg-current" />
      {label ?? LABELS[status]}
    </span>
  )
}

export { StatusPill, LABELS as statusLabels }
export type { StatusPillProps }
