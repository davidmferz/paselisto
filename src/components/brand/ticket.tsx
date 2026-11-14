import * as React from "react"
import { cn } from "cn"

type TicketProps = {
  eyebrow: string
  title: string
  meta?: React.ReactNode
  holder?: React.ReactNode
  code?: React.ReactNode
  /** QR slot; wrapped in a white box with 24px padding (quiet zone). */
  children?: React.ReactNode
  className?: string
}

function Ticket({ eyebrow, title, meta, holder, code, children, className }: TicketProps) {
  return (
    <article
      data-slot="ticket"
      className={cn("overflow-hidden rounded-[26px] bg-ink text-on-ink", className)}
    >
      <div className="flex flex-col gap-2 p-6 pb-5">
        <p className="text-label text-mango">{eyebrow}</p>
        <h2 className="text-h1">{title}</h2>
        {meta ? <p className="text-sm opacity-80">{meta}</p> : null}
      </div>
      <div className="relative h-6" aria-hidden>
        <span className="absolute inset-x-6 top-1/2 border-t-[1.5px] border-dashed border-current opacity-35" />
        <span className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-background" />
        <span className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-background" />
      </div>
      <div className="flex flex-col items-center gap-4 p-6 pt-5">
        {children ? (
          <div className="rounded-[18px] bg-white p-6 text-[#12142B]">{children}</div>
        ) : null}
        {(holder || code) && (
          <div className="flex w-full items-end justify-between gap-3">
            {holder ? (
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-label opacity-60">Titular</span>
                <span className="truncate text-sm font-bold">{holder}</span>
              </div>
            ) : <span />}
            {code ? (
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-label opacity-60">Código</span>
                <span className="font-data text-xs">{code}</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </article>
  )
}

export { Ticket }
export type { TicketProps }
