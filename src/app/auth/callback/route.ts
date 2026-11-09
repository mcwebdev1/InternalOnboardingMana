import { NextResponse } from "next/server"
import {
  GOOGLE_NO_ACCESS_MESSAGE,
  decideGoogleAccess,
  oauthErrorMessage,
} from "@/lib/google-access"
import { safeNextPath } from "@/lib/login"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeNextPath(searchParams.get("next"), origin)
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error")

  const loginWithError = (message: string) => {
    const loginUrl = new URL("/login", origin)
    loginUrl.searchParams.set("error", message)
    return NextResponse.redirect(loginUrl)
  }

  if (oauthError) return loginWithError(oauthErrorMessage(oauthError))
  if (!code) return loginWithError("Google sign in did not complete.")

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return loginWithError(error.message)

  // The database already refuses Google accounts that are not allowlisted.
  // This re-checks the new session against the allowlist before keeping it.
  const { data: facts, error: factsError } = await supabase.rpc("google_access_facts")
  const decision = factsError ? null : decideGoogleAccess(facts)
  if (!decision?.allowed) {
    // Local scope so a linked PIN account's other sessions stay untouched.
    await supabase.auth.signOut({ scope: "local" })
    return loginWithError(GOOGLE_NO_ACCESS_MESSAGE)
  }

  return NextResponse.redirect(new URL(next, origin))
}
