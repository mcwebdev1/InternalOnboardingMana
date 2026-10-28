import { EmptyState } from "@/components/empty-state"
import { ModuleCard, type AssignedModule } from "@/components/modules/module-card"
import { ProgressRing } from "@/components/modules/progress-ring"
import { UpcomingWeekBanner } from "@/components/schedule/upcoming-week-banner"
import { requireProfile } from "@/lib/auth"
import { isWeekSet, localToday, upcomingWeekStart } from "@/lib/schedule"
import { displayLogin } from "@/lib/login"
import { createClient } from "@/lib/supabase/server"
import { managersLabel, sortModuleLinks, type Module, type ModuleLink } from "@/lib/types"

export const metadata = {
  title: "My onboarding",
}

export default async function OnboardingPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const upcomingWeek = upcomingWeekStart(localToday())

  const [{ data }, { data: myManagers }, upcomingDays] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, status, module:modules(*, links:module_links(*))")
      .eq("intern_id", profile.id)
      .order("created_at", { ascending: true }),
    // Interns can read only their own managers' name and email.
    supabase.rpc("my_managers"),
    profile.role === "intern"
      ? supabase
          .from("schedules")
          .select("day")
          .eq("intern_id", profile.id)
          .eq("week_start", upcomingWeek)
      : null,
  ])

  const showScheduleBanner =
    upcomingDays !== null &&
    !upcomingDays.error &&
    !isWeekSet(
      (upcomingDays.data ?? []).map((row) => row.day),
      upcomingWeek
    )

  const internManagersList = myManagers ?? []

  const modules = (data ?? [])
    .map((row) => {
      const assignedModule = (
        Array.isArray(row.module) ? row.module[0] : row.module
      ) as (Module & { links?: ModuleLink[] | null }) | null
      if (!assignedModule) return null
      return {
        ...assignedModule,
        assignmentId: row.id,
        status: row.status,
        links: sortModuleLinks(assignedModule.links),
      } satisfies AssignedModule
    })
    .filter((row): row is AssignedModule => row !== null)
    .sort((a, b) => a.sort_order - b.sort_order)

  const finished = modules.filter((module) => module.status === "completed").length
  const percent = modules.length ? (finished / modules.length) * 100 : 0

  return (
    <div className="space-y-8">
      {showScheduleBanner ? <UpcomingWeekBanner weekStart={upcomingWeek} /> : null}

      <section className="flex flex-col gap-6 rounded-2xl bg-card px-5 py-6 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {profile.full_name ?? "Your onboarding"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {internManagersList.length === 1 ? "Manager: " : "Managers: "}
            {managersLabel(internManagersList)}
            {internManagersList.length === 1
              ? ` (${displayLogin(internManagersList[0].email)})`
              : ""}
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Open the contents in each module, then mark it assigned, started, or
            finished so your manager can see progress.
          </p>
        </div>
        <ProgressRing value={percent} />
      </section>

      {modules.length === 0 ? (
        <EmptyState
          title="Nothing assigned yet"
          description="Your manager has not sent you any modules yet. Check back after they assign your track."
        />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2">
          {modules.map((module) => (
            <ModuleCard key={module.assignmentId} module={module} />
          ))}
        </section>
      )}
    </div>
  )
}
