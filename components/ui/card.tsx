import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-[#111111]/80 backdrop-blur-xl sm:rounded-[24px]",
        className
      )}
      {...props}
    />
  )
}

function CardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("p-4 sm:p-6", className)} {...props} />
}

export { Card, CardContent }
