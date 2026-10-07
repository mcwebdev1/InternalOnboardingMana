import { notFound } from "next/navigation"
import { InternProfile } from "@/components/admin/intern-profile"
import { requireAdmin } from "@/lib/auth"
import { internManagerProfiles } from "@/lib/types"
import { createClient } from "@/lib/supabase/server"

export const metadata = {
  title: "Intern",
}

export default async function InternProfilePage({
  params,
}: {
  params: Promise<{ internId: string }>
}) {
  const { internId } = await params
  const admin = await requireAdmin()
  const supabase = await createClient()

  const [{ data: intern }, { data: modules }, { data: assignments }, { data: managers }, { data: internManagers }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", internId).maybeSingle(),
      supabase.from("modules").select("*").order("sort_order").order("title"),
      supabase
        .from("assignments")
        .select("id, module_id, status")
        .eq("intern_id", internId),
      supabase.from("profiles").select("*").in("role", ["admin", "master"]).order("email"),
      supabase.from("intern_managers").select("intern_id, manager_id").eq("intern_id", internId),
    ])

  if (!intern || intern.role !== "intern") notFound()

  return (
    <InternProfile
      intern={intern}
      internManagersList={internManagerProfiles(managers ?? [], internManagers ?? [], intern.id)}
      internManagers={internManagers ?? []}
      modules={modules ?? []}
      assignments={assignments ?? []}
      currentAdminId={admin.id}
      currentRole={admin.role}
    />
  )
}
