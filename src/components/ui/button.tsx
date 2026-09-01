import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "#/lib/utils.ts"

const buttonVariants = cva(
  /*
   * Kumo's button, restated in our tokens. Its emphasis buttons are a flat fill
   * with a top-down gradient over it, a 1px inset highlight along the top edge
   * and a ring a shade darker than the fill, which together read as a physical
   * key rather than a coloured rectangle.
   *
   * Kumo draws the gradient with an extra absolutely-positioned span inside the
   * button. Doing it as a background-image on the button itself is identical on
   * screen and leaves every call site alone: `bg-*` sets the colour underneath,
   * `bg-linear-to-b` sets the image on top of it.
   *
   * Rings rather than borders throughout, so a variant swap never changes the
   * box by a pixel.
   */
  "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap shadow-xs transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-(--primary-lift) bg-linear-to-b from-(--primary-face) to-primary text-primary-foreground ring ring-(--primary-edge) shadow-[inset_0_1px_0_0_var(--primary-lift)] hover:from-(--primary-lift)",
        destructive:
          "bg-(--destructive-lift) bg-linear-to-b from-(--destructive-face) to-destructive text-primary-foreground ring ring-(--destructive-edge) shadow-[inset_0_1px_0_0_var(--destructive-lift)] hover:from-(--destructive-lift) focus-visible:ring-destructive/50",
        outline:
          "bg-transparent ring ring-border hover:text-accent-foreground hover:ring-ring/25",
        secondary:
          "bg-card text-secondary-foreground ring ring-border hover:bg-accent",
        ghost:
          "shadow-none hover:bg-accent hover:text-accent-foreground",
        link: "shadow-none text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
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
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
