// Decides whether a Google session may stay signed in. The allowlist lives
// only in the database (private.staff_allowlist). The callback passes in
// what public.google_access_facts() returns for the signed-in user.
import type { Profile, UserRole } from "@/lib/types"

export type GoogleAccessFacts = {
  google_email: string | null
  email_verified: boolean
  allowlist_role: UserRole | null
  profile_role: UserRole | null
  profile_email: string | null
}

// The allowlist decides who may sign in with Google. The role comes from the
// profile, because a master may have changed it since the first sign in.
export type GoogleAccessDecision =
  | { allowed: true; role: UserRole }
  | { allowed: false; reason: string }

const ROLES: readonly string[] = ["intern", "admin", "master"]

export const GOOGLE_NO_ACCESS_MESSAGE =
  "This Google account does not have access to Mana Onboarding. Interns sign in with the email and PIN from their invite."

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function decideGoogleAccess(facts: unknown): GoogleAccessDecision {
  if (!facts || typeof facts !== "object") {
    return { allowed: false, reason: "no Google identity" }
  }

  const value = facts as Partial<GoogleAccessFacts>
  const googleEmail = normalizeEmail(value.google_email)

  if (!googleEmail) return { allowed: false, reason: "no Google email" }
  if (value.email_verified !== true) {
    return { allowed: false, reason: "Google email not verified" }
  }
  if (value.allowlist_role !== "admin" && value.allowlist_role !== "master") {
    return { allowed: false, reason: "not on the staff allowlist" }
  }
  if (typeof value.profile_role !== "string" || !ROLES.includes(value.profile_role)) {
    return { allowed: false, reason: "no profile" }
  }
  if (normalizeEmail(value.profile_email) !== googleEmail) {
    return { allowed: false, reason: "profile email does not match Google" }
  }

  return { allowed: true, role: value.profile_role as UserRole }
}

// Same rule as private.is_google_master(): a master whose Google sign in is
// allowlisted and matches their profile. The demo master password login has
// no Google identity, so it never counts.
export function isGoogleMaster(
  profile: Pick<Profile, "role" | "email">,
  googleFacts: unknown,
) {
  if (profile.role !== "master") return false
  if (!decideGoogleAccess(googleFacts).allowed) return false
  const facts = googleFacts as { google_email?: unknown }
  return normalizeEmail(facts.google_email) === normalizeEmail(profile.email)
}

// GoTrue reports a rejected database trigger as a generic database error.
export function oauthErrorMessage(error: string) {
  return /database error/i.test(error) ? GOOGLE_NO_ACCESS_MESSAGE : error
}
