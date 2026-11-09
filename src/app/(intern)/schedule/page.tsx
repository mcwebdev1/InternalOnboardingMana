import { ClockCard } from "@/components/schedule/clock-card"
import { SchedulePlanner } from "@/components/schedule/schedule-planner"
import { requireIntern } from "@/lib/auth"
import {
  isWeekSet,
  localToday,
  scheduleWeekStarts,
  scheduleWindowEnd,
  upcomingWeekStart,
} from "@/lib/schedule"
import { createClient } from "@/lib/supabase/server"

export const metadata = {
  title: "Schedule",
}

async function loadSchedule(internId: string) {
  const supabase = await createClient()
  const today = localToday()
  const weekStarts = scheduleWeekStarts(today)

  const [schedules, sessions] = await Promise.all([
    supabase
      .from("schedules")
      .select("day, status, start_time, end_time")
      .eq("intern_id", internId)
      .gte("day", weekStarts[0])
      .lte("day", scheduleWindowEnd(today))
      .order("day"),
    supabase
      .from("time_logs")
      .select("work_date, clock_in, clock_out, actual_hours")
      .eq("intern_id", internId)
      .or(`work_date.eq.${today},clock_out.is.null`)
      .order("clock_in"),
  ])

  return {
    today,
    weekStarts,
    loadedAt: Date.now(),
    savedDays: schedules.data ?? [],
    sessions: sessions.data ?? [],
    error: schedules.error ?? sessions.error,
  }
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const profile = await requireIntern()
  const { week } = await searchParams
  const { today, weekStarts, loadedAt, savedDays, sessions, error } = await loadSchedule(
    profile.id
  )

  const upcomingWeek = upcomingWeekStart(today)
  const upcomingSet = isWeekSet(
    savedDays.map((row) => row.day),
    upcomingWeek
  )
  const initialWeek =
    week && weekStarts.includes(week) ? week : upcomingSet ? weekStarts[0] : upcomingWeek

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Set your Monday to Friday schedule up to 8 weeks out, and clock in when you
          start work. All times are New York time.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-card px-4 py-3 text-sm text-destructive ring-1 ring-foreground/10">
          Your schedule could not be loaded: {error.message}
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <ClockCard
            sessions={sessions}
            today={today}
            serverNow={loadedAt}
            className="lg:sticky lg:top-24 lg:order-2"
          />
          <SchedulePlanner
            today={today}
            weekStarts={weekStarts}
            upcomingWeek={upcomingWeek}
            initialWeek={initialWeek}
            savedDays={savedDays}
            className="lg:order-1"
          />
        </div>
      )}
    </div>
  )
}
