import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-transparent bg-clip-padding font-bold whitespace-nowrap transition-all outline-none select-none focus-visible:ring-[3px] focus-visible:ring-mango focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-ink text-on-ink hover:bg-ink/90",
        primary: "bg-ink text-on-ink hover:bg-ink/90",
        secondary:
          "border-line bg-surface text-ink hover:bg-sunken aria-expanded:bg-sunken",
        outline:
          "border-line bg-surface text-ink hover:bg-sunken aria-expanded:bg-sunken",
        accent: "bg-mango text-ink hover:brightness-95",
        ghost: "text-ink hover:bg-sunken aria-expanded:bg-sunken",
        destructive:
          "bg-no-soft text-no hover:brightness-95 focus-visible:ring-no/40",
        link: "text-ink underline underline-offset-4 hover:no-underline",
      },
      size: {
        default: "h-13 min-h-12 px-5 text-base",
        lg: "h-13 min-h-12 px-6 text-base",
        full: "h-13 min-h-12 w-full px-5 text-base",
        sm: "h-12 px-4 text-sm",
        xs: "h-12 px-3 text-sm",
        icon: "size-12",
        "icon-sm": "size-12",
        "icon-xs": "size-12",
        "icon-lg": "size-13",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
