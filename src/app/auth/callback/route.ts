import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const nextParam = searchParams.get("next") ?? "/"
  const next = nextParam.startsWith("/") ? nextParam : "/"
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error")

  if (oauthError) {
    const loginUrl = new URL("/login", origin)
    loginUrl.searchParams.set("error", oauthError)
    return NextResponse.redirect(loginUrl)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
    const loginUrl = new URL("/login", origin)
    loginUrl.searchParams.set("error", error.message)
    return NextResponse.redirect(loginUrl)
  }

  const loginUrl = new URL("/login", origin)
  loginUrl.searchParams.set("error", "Google sign in did not complete.")
  return NextResponse.redirect(loginUrl)
}
