"use server"

import { revalidatePath } from "next/cache"
import { getCurrentProfile } from "@/lib/auth"
import { localToday, validateScheduleSubmission } from "@/lib/schedule"
import { createClient } from "@/lib/supabase/server"

// The intern comes from the session, never from the input. Each entry is a
// day with a status and optional times. Week, window, and time rules are
// re-checked here because the action is reachable without the UI.
export async function saveSchedule(
  entries: unknown
): Promise<{ error: string } | { success: true; savedDays: number }> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Your session ended. Sign in again." }
  if (profile.role !== "intern") return { error: "Only interns can set a schedule." }

  const result = validateScheduleSubmission(entries, localToday())
  if (!result.ok) return { error: result.error }

  const supabase = await createClient()
  const { error } = await supabase.from("schedules").upsert(
    result.rows.map((row) => ({ ...row, intern_id: profile.id })),
    { onConflict: "intern_id,day" }
  )
  if (error) return { error: error.message }

  revalidatePath("/schedule")
  revalidatePath("/onboarding")
  return { success: true, savedDays: result.rows.length }
}
