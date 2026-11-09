"use server"

import { revalidatePath } from "next/cache"
import { getCurrentProfile } from "@/lib/auth"
import {
  isUUID,
  localToday,
  normalizeWeekParam,
  validateScheduleSubmission,
  validateSessionInput,
  weekStartOf,
} from "@/lib/schedule"
import { createClient } from "@/lib/supabase/server"
import { isMaster, isStaff } from "@/lib/types"

type ActionResult = { error: string } | { success: true }

// Every staff action re-checks scope here, on top of RLS: master manages
// every intern, an admin only interns linked to them in intern_managers.
// Same rule as private.can_manage_intern().
async function requireManagedIntern(internId: unknown) {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Your session ended. Sign in again." } as const
  if (!isStaff(profile.role)) {
    return { ok: false, error: "Only managers can change intern schedules and time." } as const
  }
  if (!isUUID(internId)) return { ok: false, error: "That intern was not found." } as const

  const supabase = await createClient()
  const { data: intern } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", internId)
    .maybeSingle()
  if (!intern || intern.role !== "intern") {
    return { ok: false, error: "That intern was not found." } as const
  }

  if (!isMaster(profile.role)) {
    const { data: link } = await supabase
      .from("intern_managers")
      .select("intern_id")
      .eq("intern_id", internId)
      .eq("manager_id", profile.id)
      .maybeSingle()
    if (!link) return { ok: false, error: "You can only change interns on your team." } as const
  }

  return { ok: true, supabase, internId } as const
}

function timeLogError(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    return "This intern already has an open session. Add a clock out time to it first."
  }
  if (error.code === "23514") return "Clock out must be after clock in."
  if (/future/i.test(error.message)) return `${error.message}.`
  return error.message
}

export async function overrideInternSchedule(
  internId: string,
  weekStart: string,
  entries: unknown
): Promise<ActionResult> {
  const scope = await requireManagedIntern(internId)
  if (!scope.ok) return { error: scope.error }

  const week = normalizeWeekParam(weekStart, localToday())
  const result = validateScheduleSubmission(entries, localToday(), { staffOverride: true })
  if (!result.ok) return { error: result.error }
  if (result.rows.some((row) => weekStartOf(row.day) !== week)) {
    return { error: "Every day must be in the week you are editing." }
  }

  const { error } = await scope.supabase.from("schedules").upsert(
    result.rows.map((row) => ({ ...row, intern_id: scope.internId })),
    { onConflict: "intern_id,day" }
  )
  if (error) return { error: error.message }

  revalidatePath("/admin/schedule")
  return { success: true }
}

// Writes only clock_in and clock_out. The database computes work_date and
// actual_hours. A null sessionId adds a new session.
export async function saveTimeSession(
  internId: string,
  sessionId: string | null,
  input: unknown
): Promise<ActionResult> {
  const scope = await requireManagedIntern(internId)
  if (!scope.ok) return { error: scope.error }
  if (sessionId !== null && !isUUID(sessionId)) {
    return { error: "That session was not found." }
  }

  const result = validateSessionInput(input, Date.now())
  if (!result.ok) return { error: result.error }
  const values = { clock_in: result.clock_in, clock_out: result.clock_out }

  if (sessionId) {
    const { data, error } = await scope.supabase
      .from("time_logs")
      .update(values)
      .eq("id", sessionId)
      .eq("intern_id", scope.internId)
      .select("id")
    if (error) return { error: timeLogError(error) }
    if (!data || data.length === 0) return { error: "That session was not found." }
  } else {
    const { error } = await scope.supabase
      .from("time_logs")
      .insert({ ...values, intern_id: scope.internId })
    if (error) return { error: timeLogError(error) }
  }

  revalidatePath("/admin/schedule")
  return { success: true }
}

export async function deleteTimeSession(
  internId: string,
  sessionId: string
): Promise<ActionResult> {
  const scope = await requireManagedIntern(internId)
  if (!scope.ok) return { error: scope.error }
  if (!isUUID(sessionId)) return { error: "That session was not found." }

  const { data, error } = await scope.supabase
    .from("time_logs")
    .delete()
    .eq("id", sessionId)
    .eq("intern_id", scope.internId)
    .select("id")
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: "That session was not found." }

  revalidatePath("/admin/schedule")
  return { success: true }
}
