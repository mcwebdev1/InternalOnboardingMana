import { PeopleManager } from "@/components/admin/people-manager"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const metadata = {
  title: "Interns",
}

export default async function AdminPeoplePage() {
  const admin = await requireAdmin()
  const supabase = await createClient()
  const [{ data: interns }, { data: managers }, { data: internManagers }, { data: assignments }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("role", "intern").order("email"),
      supabase.from("profiles").select("*").in("role", ["admin", "master"]).order("email"),
      supabase.from("intern_managers").select("intern_id, manager_id"),
      supabase.from("assignments").select("intern_id, status"),
    ])

  const people = (interns ?? []).map((intern) => {
    const rows = (assignments ?? []).filter((row) => row.intern_id === intern.id)
    return {
      intern,
      assigned: rows.filter((row) => row.status === "not_started").length,
      started: rows.filter((row) => row.status === "in_progress").length,
      finished: rows.filter((row) => row.status === "completed").length,
    }
  })

  return (
    <PeopleManager
      people={people}
      managers={managers ?? []}
      internManagers={internManagers ?? []}
      currentAdminId={admin.id}
      currentRole={admin.role}
    />
  )
}
