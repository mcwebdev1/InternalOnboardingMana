"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { resolveLogin, safeNextPath } from "@/lib/login"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm({
  nextPath = "/",
  initialError,
}: {
  nextPath?: string
  initialError?: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [pending, setPending] = useState(false)
  const [googlePending, setGooglePending] = useState(false)

  async function handleGoogle() {
    setError(null)
    setGooglePending(true)
    const supabase = createClient()
    const redirectTo = new URL("/auth/callback", window.location.origin)
    redirectTo.searchParams.set("next", nextPath)
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    })
    if (result.error) {
      setError(result.error.message)
      setGooglePending(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    const email = resolveLogin(String(form.get("email") ?? ""))
    const password = String(form.get("password") ?? "")
    const supabase = createClient()
    const result = await supabase.auth.signInWithPassword({ email, password })

    if (result.error) {
      setError(result.error.message)
      setPending(false)
      return
    }

    router.replace(safeNextPath(nextPath, window.location.origin))
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full cursor-pointer"
        disabled={googlePending || pending}
        onClick={handleGoogle}
      >
        <GoogleMark />
        {googlePending ? "Opening Google..." : "Continue with Google"}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or use email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form className="space-y-4" method="post" action="#" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="signin-email">Email</Label>
          <Input
            id="signin-email"
            name="email"
            type="text"
            autoComplete="username"
            required
            className="h-11"
            placeholder="you@mana.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signin-password">PIN or password</Label>
          <Input
            id="signin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-11"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="h-11 w-full cursor-pointer" disabled={pending || googlePending}>
          {pending ? "Signing in..." : "Continue with email"}
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          Continue with Google is for Mana staff. Interns sign in with the email and
          6-digit PIN from their invite. Demo accounts use their existing logins.
        </p>
      </form>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.55-5.17 3.55-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.08.72-2.47 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.62l4 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  )
}
