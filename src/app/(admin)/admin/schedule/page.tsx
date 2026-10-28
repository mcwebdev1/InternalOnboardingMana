import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { TeamScheduleGrid, type StaffIntern } from "@/components/schedule/team-schedule-grid"
import { WeekReportTable, type InternWeekReport } from "@/components/schedule/week-report-table"
import { Button } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { displayLogin } from "@/lib/login"
import {
  REVIEW_SESSION_HOURS,
  addDays,
  buildWeekReport,
  formatDateLabel,
  localToday,
  normalizeWeekParam,
  weekStartOf,
} from "@/lib/schedule"
import { createClient } from "@/lib/supabase/server"
import { internName, isMaster, type Profile } from "@/lib/types"

export const metadata = {
  title: "Schedule",
}

// Master sees every intern. An admin sees only interns linked to them.
async function loadTeam(profile: Profile, weekStart: string) {
  const supabase = await createClient()

  let internIds: string[] | null = null
  if (!isMaster(profile.role)) {
    const { data: links, error } = await supabase
      .from("intern_managers")
      .select("intern_id")
      .eq("manager_id", profile.id)
    if (error) return { error }
    internIds = (links ?? []).map((link) => link.intern_id)
    if (internIds.length === 0) {
      return { interns: [], schedules: [], sessions: [], nowMs: Date.now() }
    }
  }

  let internQuery = supabase
    .from("profiles")
    .select("*")
    .eq("role", "intern")
    .order("full_name")
  if (internIds) internQuery = internQuery.in("id", internIds)
  const { data: internRows, error: internError } = await internQuery
  if (internError) return { error: internError }

  const ids = (internRows ?? []).map((intern) => intern.id)
  if (ids.length === 0) return { interns: [], schedules: [], sessions: [], nowMs: Date.now() }

  const weekEnd = addDays(weekStart, 4)
  const [schedules, sessions] = await Promise.all([
    supabase
      .from("schedules")
      .select("intern_id, day, status, start_time, end_time")
      .in("intern_id", ids)
      .eq("week_start", weekStart),
    supabase
      .from("time_logs")
      .select("id, intern_id, work_date, clock_in, clock_out, actual_hours")
      .in("intern_id", ids)
      .or(`and(work_date.gte.${weekStart},work_date.lte.${weekEnd}),clock_out.is.null`)
      .order("clock_in"),
  ])
  const error = schedules.error ?? sessions.error
  if (error) return { error }

  const interns: StaffIntern[] = (internRows ?? [])
    .map((intern) => ({
      id: intern.id,
      name: internName(intern),
      login: displayLogin(intern.email),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    interns,
    schedules: schedules.data ?? [],
    sessions: sessions.data ?? [],
    nowMs: Date.now(),
  }
}

export default async function StaffSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const profile = await requireAdmin()
  const { week } = await searchParams
  const today = localToday()
  const weekStart = normalizeWeekParam(week, today)
  const currentWeek = weekStartOf(today)
  const team = await loadTeam(profile, weekStart)

  const weekLabel = formatDateLabel(weekStart, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {isMaster(profile.role)
              ? "Every intern's availability and time. "
              : "Availability and time for interns on your team. "}
            Edit a schedule or open a day to fix time sessions. All times are New York time.
          </p>
        </div>
        <nav aria-label="Week" className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" className="size-11 cursor-pointer">
            <Link href={`/admin/schedule?week=${addDays(weekStart, -7)}`} aria-label="Previous week">
              <ChevronLeft />
            </Link>
          </Button>
          <Button
            asChild
            variant={weekStart === currentWeek ? "secondary" : "outline"}
            className="h-11 cursor-pointer px-4"
          >
            <Link href="/admin/schedule">This week</Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="size-11 cursor-pointer">
            <Link href={`/admin/schedule?week=${addDays(weekStart, 7)}`} aria-label="Next week">
              <ChevronRight />
            </Link>
          </Button>
        </nav>
      </div>

      <p className="text-sm font-medium">Week of {weekLabel}</p>

      {"error" in team && team.error ? (
        <p role="alert" className="rounded-xl bg-card px-4 py-3 text-sm text-destructive ring-1 ring-foreground/10">
          The schedule could not be loaded: {team.error.message}
        </p>
      ) : "interns" in team && team.interns.length === 0 ? (
        isMaster(profile.role) ? (
          <EmptyState
            title="No intern accounts yet"
            description="Create intern accounts from Interns. Their schedules and time show up here once they start using Schedule."
            action={{ href: "/admin/people", label: "Go to Interns" }}
          />
        ) : (
          <EmptyState
            title="No interns on your team yet"
            description="You only see interns you manage. Open Interns and add yourself as a manager to see their schedule and time here."
            action={{ href: "/admin/people", label: "Go to Interns" }}
          />
        )
      ) : "interns" in team ? (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Team availability</h2>
              <p className="text-sm text-muted-foreground">
                What each intern planned for the week. Use Edit schedule to change it.
              </p>
            </div>
            <TeamScheduleGrid
              interns={team.interns}
              weekStart={weekStart}
              today={today}
              schedules={team.schedules}
            />
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Week report</h2>
              <p className="text-sm text-muted-foreground">
                Planned hours and time worked. Needs review marks a session still open
                from an earlier day or longer than {REVIEW_SESSION_HOURS} hours. Open a
                day to add, edit, or delete sessions.
              </p>
            </div>
            <WeekReportTable
              today={today}
              rows={team.interns.map((intern): InternWeekReport => {
                const internSessions = team.sessions.filter(
                  (session) => session.intern_id === intern.id
                )
                const report = buildWeekReport({
                  weekStart,
                  today,
                  nowMs: team.nowMs,
                  schedules: team.schedules.filter((row) => row.intern_id === intern.id),
                  sessions: internSessions,
                })
                const staleOpen = internSessions.find(
                  (session) =>
                    session.clock_out === null &&
                    session.work_date < today &&
                    weekStartOf(session.work_date) !== weekStart
                )
                return {
                  intern,
                  days: report.days,
                  totalHours: report.totalHours,
                  staleOpenSince: staleOpen?.work_date ?? null,
                }
              })}
            />
          </section>
        </>
      ) : null}
    </div>
  )
}
