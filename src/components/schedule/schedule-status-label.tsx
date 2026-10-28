import { SCHEDULE_STATUS_LABELS, STATUS_COLORS } from "@/lib/schedule"
import type { ScheduleStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ScheduleStatusLabel({
  status,
  className,
}: {
  status: ScheduleStatus
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: STATUS_COLORS[status] }}
      />
      {SCHEDULE_STATUS_LABELS[status]}
    </span>
  )
}
