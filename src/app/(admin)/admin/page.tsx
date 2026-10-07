import Link from "next/link"
import { StatCard } from "@/components/admin/stat-card"
import { EmptyState } from "@/components/empty-state"
import { displayLogin } from "@/lib/login"
import {
  internManagerProfiles,
  internName,
  managersLabel,
} from "@/lib/types"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Admin",
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const [{ data: interns }, { data: managers }, { data: internManagers }, { data: modules }, { data: assignments }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("role", "intern").order("email"),
      supabase.from("profiles").select("*").in("role", ["admin", "master"]).order("email"),
      supabase.from("intern_managers").select("intern_id, manager_id"),
      supabase.from("modules").select("id"),
      supabase.from("assignments").select("intern_id, status"),
    ])

  const internRows = interns ?? []
  const managerRows = managers ?? []
  const managerLinks = internManagers ?? []
  const assignmentRows = assignments ?? []
  const finished = assignmentRows.filter((row) => row.status === "completed").length
  const completionRate = assignmentRows.length
    ? Math.round((finished / assignmentRows.length) * 100)
    : 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Open an intern to review progress. Assign them to yourself from
            Interns if you own their track. You can add more than one manager.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-11 cursor-pointer px-4">
            <Link href="/admin/people">Interns</Link>
          </Button>
          <Button asChild className="h-11 cursor-pointer px-4">
            <Link href="/admin/assign">Assign modules</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Interns" value={String(internRows.length)} hint="Intern accounts" />
        <StatCard label="Modules" value={String(modules?.length ?? 0)} hint="Items in the library" />
        <StatCard
          label="Finished"
          value={`${completionRate}%`}
          hint={`${finished} of ${assignmentRows.length} assignments finished`}
        />
      </section>

      {internRows.length === 0 ? (
        <EmptyState
          title="No intern accounts yet"
          description="Create intern accounts from Interns, then send only the modules each person needs."
          action={{ href: "/admin/people", label: "Create intern accounts" }}
        />
      ) : (
        <section className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <div className="grid grid-cols-[1.1fr_0.9fr_repeat(3,0.45fr)] gap-4 bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Intern</span>
            <span>Managers</span>
            <span>Assigned</span>
            <span>Started</span>
            <span>Finished</span>
          </div>
          <ul className="divide-y divide-border">
            {internRows.map((intern) => {
              const rows = assignmentRows.filter((row) => row.intern_id === intern.id)
              const assigned = rows.filter((row) => row.status === "not_started").length
              const started = rows.filter((row) => row.status === "in_progress").length
              const done = rows.filter((row) => row.status === "completed").length
              const internManagersList = internManagerProfiles(
                managerRows,
                managerLinks,
                intern.id
              )

              return (
                <li
                  key={intern.id}
                  className="grid grid-cols-[1.1fr_0.9fr_repeat(3,0.45fr)] items-center gap-4 px-4 py-4"
                >
                  <div>
                    <Link
                      href={`/admin/people/${intern.id}`}
                      className="font-medium transition-colors duration-200 hover:text-foreground"
                    >
                      {internName(intern)}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {displayLogin(intern.email)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {managersLabel(internManagersList)}
                  </p>
                  <p className="text-sm">{assigned}</p>
                  <p className="text-sm">{started}</p>
                  <p className="text-sm">{done}</p>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
