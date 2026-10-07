"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { updateAssignmentStatus } from "@/lib/actions/assignments"
import { STATUS_OPTIONS, type AssignmentStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

export function StatusToggle({
  assignmentId,
  status,
}: {
  assignmentId: string
  status: AssignmentStatus
}) {
  const [pending, startTransition] = useTransition()

  return (
    <div
      role="radiogroup"
      aria-label="Module progress"
      className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
    >
      {STATUS_OPTIONS.map((option) => {
        const selected = option.value === status
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={pending || selected}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              startTransition(async () => {
                const result = await updateAssignmentStatus(assignmentId, option.value)
                if ("error" in result) toast.error(result.error)
              })
            }}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors duration-200 sm:text-sm",
              selected
                ? option.value === "completed"
                  ? "bg-[#4EAD63]/20 text-[#8BDB9A]"
                  : option.value === "in_progress"
                    ? "bg-[#5CA1F3]/20 text-[#9CC6F8]"
                    : "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
