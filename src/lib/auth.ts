import { redirect } from "next/navigation"
import { canManageIntern } from "@/lib/access"
import { isGoogleMaster } from "@/lib/google-access"
import { createClient } from "@/lib/supabase/server"
import { isMaster, isStaff, type Profile } from "@/lib/types"

export async function getCurrentProfile() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  if (!userId) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()

  if (!profile) {
    await supabase.auth.signOut()
    return null
  }

  return profile
}

export async function requireProfile() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  return profile
}

export async function requireIntern() {
  const profile = await requireProfile()
  if (isStaff(profile.role)) redirect("/admin")
  return profile
}

export async function requireAdmin() {
  const profile = await requireProfile()
  if (!isStaff(profile.role)) redirect("/onboarding")
  return profile
}

export async function requireMaster() {
  const profile = await requireAdmin()
  if (!isMaster(profile.role)) redirect("/admin")
  return profile
}

// True when this session is a master signed in with an allowlisted Google
// account. Only they change roles or remove staff Google accounts.
export async function isGoogleMasterSession(profile: Profile) {
  if (!isMaster(profile.role)) return false
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("google_access_facts")
  return !error && isGoogleMaster(profile, data)
}

// Error when the profile may not send, change, or remove this intern's
// modules, or null when it may. Same rule as private.can_manage_intern().
export async function managedInternError(profile: Profile, internId: string) {
  const supabase = await createClient()
  const [{ data: intern }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("id, role").eq("id", internId).maybeSingle(),
    supabase.from("intern_managers").select("manager_id").eq("intern_id", internId),
  ])
  if (!intern || intern.role !== "intern") return "That intern was not found."
  const managerIds = (links ?? []).map((link) => link.manager_id)
  if (!canManageIntern(profile, managerIds)) {
    return "You can only change modules for interns on your team."
  }
  return null
}
