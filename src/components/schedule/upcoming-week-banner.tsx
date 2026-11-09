import Link from "next/link"
import { CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDateLabel } from "@/lib/schedule"

export function UpcomingWeekBanner({ weekStart }: { weekStart: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card/80 px-4 py-3 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm">
        <CalendarClock className="size-4 shrink-0 text-[#F5C443]" />
        Your schedule for the week of {formatDateLabel(weekStart)} is not set.
      </p>
      <Button asChild variant="outline" className="h-11 cursor-pointer px-4">
        <Link href={`/schedule?week=${weekStart}`}>Set schedule</Link>
      </Button>
    </div>
  )
}
