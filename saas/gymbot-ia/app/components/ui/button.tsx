"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8FF3E] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#A8FF3E] text-[#0D0F0E] hover:bg-[#8FE62A] active:scale-[0.98]",
        outline:
          "border border-[#2A2D2C] bg-transparent text-[#F2F0EB] hover:border-[#A8FF3E] hover:text-[#A8FF3E]",
        ghost:
          "text-[#F2F0EB] hover:bg-[#1A1D1C] hover:text-[#F2F0EB]",
        destructive:
          "bg-[#FF4444] text-white hover:bg-[#DD3333]",
        secondary:
          "bg-[#1A1D1C] text-[#F2F0EB] hover:bg-[#2A2D2C]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
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
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
