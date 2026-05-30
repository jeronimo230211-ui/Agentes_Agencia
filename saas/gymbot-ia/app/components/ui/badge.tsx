import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[#A8FF3E]/20 text-[#A8FF3E] border border-[#A8FF3E]/30",
        secondary: "bg-[#1A1D1C] text-[#8B8F8D] border border-[#2A2D2C]",
        destructive: "bg-[#FF4444]/20 text-[#FF4444] border border-[#FF4444]/30",
        outline: "border border-[#2A2D2C] text-[#F2F0EB]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
