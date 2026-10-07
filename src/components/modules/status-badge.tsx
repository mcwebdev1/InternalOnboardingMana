import { Badge } from "@/components/ui/badge"
import { STATUS_LABELS, type AssignmentStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

export function StatusBadge({
  status,
  className,
}: {
  status: AssignmentStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 border-transparent px-2.5",
        status === "completed" && "bg-[#4EAD63]/15 text-[#8BDB9A]",
        status === "in_progress" && "bg-[#5CA1F3]/15 text-[#9CC6F8]",
        status === "not_started" && "bg-muted text-muted-foreground",
        className
      )}
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}
