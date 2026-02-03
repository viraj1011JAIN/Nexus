import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation active:transition-transform active:duration-75",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]",
        destructive:
          "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98]",
        outline:
          "border-2 border-purple-600 text-purple-600 bg-white hover:bg-purple-50 shadow-sm hover:shadow-md",
        secondary:
          "bg-white border-2 border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-gray-300 shadow-sm hover:shadow-md",
        ghost:
          "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
        link: "text-purple-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6 text-[15px] has-[>svg]:px-4",
        xs: "h-8 gap-1 rounded-md px-3 text-[13px] has-[>svg]:px-2",
        sm: "h-9 rounded-md gap-1.5 px-4 text-[13px] has-[>svg]:px-3",
        lg: "h-14 rounded-lg px-8 text-[15px] has-[>svg]:px-6",
        icon: "size-10",
        "icon-xs": "size-7 rounded-md",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
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
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      suppressHydrationWarning
      {...props}
    />
  )
}

export { Button, buttonVariants }
