import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isMaster, isStaff } from "@/lib/types"

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
