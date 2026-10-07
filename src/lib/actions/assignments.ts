"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin, requireProfile } from "@/lib/auth"
import { isStaff } from "@/lib/types"
import { createClient } from "@/lib/supabase/server"
import type { Enums } from "@/lib/database.types"

export async function saveInternAssignments(
  internId: string,
  moduleIds: string[]
) {
  const admin = await requireAdmin()
  const supabase = await createClient()

  const { data: existing, error: existingError } = await supabase
    .from("assignments")
    .select("id, module_id")
    .eq("intern_id", internId)

  if (existingError) return { error: existingError.message }

  const currentIds = new Set((existing ?? []).map((row) => row.module_id))
  const nextIds = new Set(moduleIds)

  const toDelete = (existing ?? [])
    .filter((row) => !nextIds.has(row.module_id))
    .map((row) => row.id)
  const toInsert = moduleIds.filter((id) => !currentIds.has(id))

  if (toDelete.length) {
    const { error } = await supabase.from("assignments").delete().in("id", toDelete)
    if (error) return { error: error.message }
  }

  if (toInsert.length) {
    const { error } = await supabase.from("assignments").insert(
      toInsert.map((moduleId) => ({
        intern_id: internId,
        module_id: moduleId,
        assigned_by: admin.id,
      }))
    )
    if (error) return { error: error.message }
  }

  revalidatePath("/onboarding")
  revalidatePath("/admin")
  revalidatePath("/admin/people")
  revalidatePath("/admin/assign")
  revalidatePath(`/admin/people/${internId}`)
  return { success: true }
}

export async function saveAssignmentsForInterns(
  internIds: string[],
  moduleIds: string[]
) {
  for (const internId of internIds) {
    const result = await saveInternAssignments(internId, moduleIds)
    if (result.error) return result
  }
  return { success: true }
}

export async function updateAssignmentStatus(
  assignmentId: string,
  status: Enums<"assignment_status">
) {
  const profile = await requireProfile()
  const supabase = await createClient()

  const patch = {
    status,
    started_at:
      status === "in_progress" || status === "completed"
        ? new Date().toISOString()
        : null,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  }

  if (status === "in_progress") {
    const { data: current } = await supabase
      .from("assignments")
      .select("started_at")
      .eq("id", assignmentId)
      .maybeSingle()

    patch.started_at = current?.started_at ?? new Date().toISOString()
    patch.completed_at = null
  }

  if (status === "not_started") {
    patch.started_at = null
    patch.completed_at = null
  }

  const query = supabase.from("assignments").update(patch).eq("id", assignmentId)
  const scoped = isStaff(profile.role) ? query : query.eq("intern_id", profile.id)

  const { error } = await scoped
  if (error) return { error: error.message }

  revalidatePath("/onboarding")
  revalidatePath("/admin")
  revalidatePath("/admin/people")
  revalidatePath("/admin/assign")
  return { success: true }
}
