"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin, requireMaster } from "@/lib/auth"
import { parseInviteResult, type InviteCredentials } from "@/lib/invite"
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
  await requireAdmin()
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

export async function addInternManager(internId: string, managerId?: string) {
  const admin = await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("intern_managers").insert({
    intern_id: internId,
    manager_id: managerId ?? admin.id,
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
  if (targetId !== admin.id && !isMaster(admin.role)) {
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

export async function deleteInternAccount(userId: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.rpc("delete_intern", {
    p_user_id: userId,
  })
  if (error) return { error: error.message }
  revalidatePeople(userId)
  return { success: true }
}
