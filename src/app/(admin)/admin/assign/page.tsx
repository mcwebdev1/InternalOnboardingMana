import { AssignPanel } from "@/components/admin/assign-panel"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const metadata = {
  title: "Assign",
}

export default async function AdminAssignPage() {
  const admin = await requireAdmin()
  const supabase = await createClient()
  const [{ data: interns }, { data: managers }, { data: internManagers }, { data: modules }, { data: assignments }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("role", "intern").order("email"),
      supabase.from("profiles").select("*").in("role", ["admin", "master"]).order("email"),
      supabase.from("intern_managers").select("intern_id, manager_id"),
      supabase.from("modules").select("*").order("sort_order"),
      supabase.from("assignments").select("intern_id, module_id"),
    ])

  return (
    <AssignPanel
      interns={interns ?? []}
      managers={managers ?? []}
      internManagers={internManagers ?? []}
      modules={modules ?? []}
      assignments={assignments ?? []}
      currentAdminId={admin.id}
      currentRole={admin.role}
    />
  )
}
