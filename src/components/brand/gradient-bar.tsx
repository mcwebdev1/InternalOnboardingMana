import { cn } from "@/lib/utils"

export function GradientBar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-[3px] w-full bg-[image:var(--brand-gradient)]", className)}
    />
  )
}
