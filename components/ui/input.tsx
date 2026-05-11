import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-12 w-full rounded-2xl border border-white/10 bg-[#151515] px-4 text-sm text-white placeholder:text-zinc-500 outline-none transition-all focus:border-[#F5C542]/60 focus:ring-2 focus:ring-[#F5C542]/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
