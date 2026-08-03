import * as React from "react"

import { cn } from "@/lib/utils"

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-all focus:border-[#C8102E]/50 focus:ring-2 focus:ring-[#C8102E]/15",
        className
      )}
      {...props}
    />
  )
}

export { Select }
