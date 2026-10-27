"use server"

import { revalidatePath } from "next/cache"
import { getCurrentProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// No arguments: the database functions use the session user and server time.
async function runClockFunction(fn: "clock_in" | "clock_out") {
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Your session ended. Sign in again." }
  if (profile.role !== "intern") return { error: "Only interns can clock in and out." }

  const supabase = await createClient()
  const { error } = await supabase.rpc(fn)
  if (error) return { error: error.message }

  revalidatePath("/schedule")
  return { success: true as const }
}

export async function clockIn() {
  return runClockFunction("clock_in")
}

export async function clockOut() {
  return runClockFunction("clock_out")
}
