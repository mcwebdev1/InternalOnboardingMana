import { TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function NeedsReviewBadge() {
  return (
    <Badge
      variant="outline"
      className="h-6 gap-1 border-transparent bg-[#F5C443]/15 px-2 text-[#F5C443]"
    >
      <TriangleAlert className="size-3" />
      Needs review
    </Badge>
  )
}
