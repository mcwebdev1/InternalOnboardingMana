"use server"

import { revalidatePath } from "next/cache"
import { canLinkManager, isUserRole, managerIdsError, roleChangeError } from "@/lib/access"
import { isGoogleMasterSession, requireAdmin, requireMaster } from "@/lib/auth"
import { parseInviteResult, type InviteCredentials } from "@/lib/invite"
import { isUUID } from "@/lib/schedule"
import { createClient } from "@/lib/supabase/server"
import { isMaster } from "@/lib/types"

function revalidatePeople(internId?: string) {
  revalidatePath("/admin")
  revalidatePath("/admin/people")
  revalidatePath("/admin/assign")
  revalidatePath("/onboarding")
  if (internId) revalidatePath(`/admin/people/${internId}`)
}

export async function createInternAccount(input: {
  email: string
  fullName: string
  managerIds: string[]
}): Promise<{ error: string } | { success: true; invite: InviteCredentials }> {
  const admin = await requireAdmin()
  // create_intern enforces this too. An admin can only add themselves.
  const managerError = managerIdsError(admin, input.managerIds)
  if (managerError) return { error: managerError }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_intern", {
    p_email: input.email,
    p_full_name: input.fullName,
    p_manager_ids: input.managerIds,
  })
  if (error) return { error: error.message }
  const invite = parseInviteResult(data)
  if (!invite) return { error: "Intern account was created, but the PIN could not be shown." }
  revalidatePeople()
  return { success: true, invite }
}

export async function createManagerAccount(input: {
  email: string
  fullName: string
}): Promise<{ error: string } | { success: true; invite: InviteCredentials }> {
  await requireMaster()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_manager", {
    p_email: input.email,
    p_full_name: input.fullName,
  })
  if (error) return { error: error.message }
  const invite = parseInviteResult(data)
  if (!invite) return { error: "Manager account was created, but the PIN could not be shown." }
  revalidatePeople()
  return { success: true, invite }
}

// An admin links only themselves. Master links any manager. The
// intern_managers insert policy enforces the same rule.
export async function addInternManager(internId: string, managerId?: string) {
  const admin = await requireAdmin()
  const targetId = managerId ?? admin.id
  if (!canLinkManager(admin, targetId)) {
    return { error: "Only the master admin can add other managers." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("intern_managers").insert({
    intern_id: internId,
    manager_id: targetId,
    created_by: admin.id,
  })
  if (error) {
    if (error.code === "23505") return { success: true }
    return { error: error.message }
  }
  revalidatePeople(internId)
  return { success: true }
}

export async function claimIntern(internId: string) {
  return addInternManager(internId)
}

export async function removeInternManager(internId: string, managerId?: string) {
  const admin = await requireAdmin()
  const targetId = managerId ?? admin.id
  if (!canLinkManager(admin, targetId)) {
    return { error: "You can only remove yourself as a manager." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("intern_managers")
    .delete()
    .eq("intern_id", internId)
    .eq("manager_id", targetId)
  if (error) return { error: error.message }
  revalidatePeople(internId)
  return { success: true }
}

export async function unclaimIntern(internId: string) {
  return removeInternManager(internId)
}

// Master only: replace an intern's managers with exactly this list.
export async function setInternManagers(internId: string, managerIds: string[]) {
  const master = await requireMaster()
  if (!isUUID(internId) || !managerIds.every(isUUID)) {
    return { error: "That intern or manager was not found." }
  }

  const supabase = await createClient()
  const { data: links, error: linksError } = await supabase
    .from("intern_managers")
    .select("manager_id")
    .eq("intern_id", internId)
  if (linksError) return { error: linksError.message }

  const current = new Set((links ?? []).map((link) => link.manager_id))
  const next = new Set(managerIds)
  const toAdd = [...next].filter((id) => !current.has(id))
  const toRemove = [...current].filter((id) => !next.has(id))

  if (toAdd.length) {
    const { error } = await supabase.from("intern_managers").insert(
      toAdd.map((managerId) => ({
        intern_id: internId,
        manager_id: managerId,
        created_by: master.id,
      }))
    )
    if (error) return { error: error.message }
  }

  if (toRemove.length) {
    const { error } = await supabase
      .from("intern_managers")
      .delete()
      .eq("intern_id", internId)
      .in("manager_id", toRemove)
    if (error) return { error: error.message }
  }

  revalidatePeople(internId)
  return { success: true }
}

// Only a master signed in with Google changes roles, never their own. The
// profiles trigger enforces the same rule and drops manager links that no
// longer fit the new role.
export async function changeUserRole(userId: string, role: string) {
  const master = await requireMaster()
  const googleMaster = await isGoogleMasterSession(master)
  const roleError = roleChangeError({ ...master, googleMaster }, userId, role)
  if (roleError) return { error: roleError }
  if (!isUUID(userId) || !isUserRole(role)) return { error: "That account was not found." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id")
  if (error) return { error: error.message }
  if (!data?.length) return { error: "That account was not found." }

  revalidatePath("/", "layout")
  return { success: true }
}

export async function deleteInternAccount(userId: string) {
  const admin = await requireAdmin()
  const supabase = await createClient()

  // delete_intern enforces this too. A regular admin removes only their interns.
  if (!isMaster(admin.role)) {
    const { data: link } = await supabase
      .from("intern_managers")
      .select("intern_id")
      .eq("intern_id", userId)
      .eq("manager_id", admin.id)
      .maybeSingle()
    if (!link) return { error: "You can only remove interns on your team." }
  }

  const { error } = await supabase.rpc("delete_intern", {
    p_user_id: userId,
  })
  if (error) return { error: error.message }
  revalidatePeople(userId)
  return { success: true }
}

// Master only. delete_manager also refuses masters, the caller, and demo
// accounts, and revokes an allowlisted Google address.
export async function deleteManagerAccount(userId: string) {
  const master = await requireMaster()
  if (userId === master.id) return { error: "You cannot remove your own account." }

  const supabase = await createClient()
  const { error } = await supabase.rpc("delete_manager", {
    p_user_id: userId,
  })
  if (error) return { error: error.message }
  revalidatePeople()
  return { success: true }
}
