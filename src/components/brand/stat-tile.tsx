import * as React from "react"
import { cn } from "cn"

type StatTileProps = {
  label: string
  value: React.ReactNode
  tone?: "default" | "ok" | "wait" | "no" | "mango"
  className?: string
}

const tones = {
  default: "bg-surface text-ink border-line",
  ok: "bg-ok-soft text-ok border-transparent",
  wait: "bg-wait-soft text-wait border-transparent",
  no: "bg-no-soft text-no border-transparent",
  mango: "bg-mango-soft text-ink border-transparent",
}

function StatTile({ label, value, tone = "default", className }: StatTileProps) {
  return (
    <div
      data-slot="stat-tile"
      className={cn("flex flex-col gap-1 rounded-[24px] border p-4", tones[tone], className)}
    >
      <span className="text-label opacity-80">{label}</span>
      <span className="font-data text-[28px] leading-none font-bold">{value}</span>
    </div>
  )
}

type StatStripProps = {
  stats: StatTileProps[]
  className?: string
}

/** Counter strip: 2 columns on phones, one row from sm up. */
function StatStrip({ stats, className }: StatStripProps) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-none sm:grid-flow-col sm:auto-cols-fr", className)}
      style={{ gridTemplateColumns: undefined }}
    >
      {stats.map((s) => (
        <StatTile key={s.label} {...s} />
      ))}
    </div>
  )
}

export { StatTile, StatStrip }
export type { StatTileProps, StatStripProps }
