import * as React from "react"
import { cn } from "cn"

type InputProps = Omit<React.ComponentProps<"input">, "prefix"> & {
  /** Icon rendered inside the field, left side. */
  icon?: React.ReactNode
  /** Text before the value, e.g. "$". */
  prefix?: React.ReactNode
  /** Text after the value, e.g. "MXN". */
  suffix?: React.ReactNode
  wrapperClassName?: string
}

const fieldBase =
  "flex min-h-13 w-full items-center gap-2 rounded-[14px] border-[1.5px] border-line-strong bg-surface px-4 text-ink transition-colors focus-within:border-ink focus-within:ring-[3px] focus-within:ring-mango/60 has-[input:disabled]:opacity-50 has-[input[aria-invalid=true]]:border-no"

function Input({
  className,
  wrapperClassName,
  type,
  icon,
  prefix,
  suffix,
  ...props
}: InputProps) {
  return (
    <div data-slot="input-wrapper" className={cn(fieldBase, "h-13", wrapperClassName)}>
      {icon ? <span className="text-muted-foreground [&_svg]:size-5" aria-hidden>{icon}</span> : null}
      {prefix ? <span className="font-data text-muted-foreground">{prefix}</span> : null}
      <input
        type={type}
        data-slot="input"
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
      {suffix ? <span className="text-label text-muted-foreground">{suffix}</span> : null}
    </div>
  )
}

export { Input, fieldBase }
export type { InputProps }
