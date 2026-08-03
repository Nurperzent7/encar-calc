import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]/40",
  {
    variants: {
      variant: {
        default:
          "bg-[#C8102E] text-white shadow-[0_10px_30px_rgba(200,16,46,0.25)] hover:bg-[#9F0C24]",
        ghost:
          "border border-zinc-200 bg-white text-zinc-800 hover:border-[#C8102E]/40 hover:bg-[#C8102E]/5",
        subtle:
          "bg-zinc-100 text-zinc-800 hover:bg-zinc-200",
      },
      size: {
        default: "h-11 px-5",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
