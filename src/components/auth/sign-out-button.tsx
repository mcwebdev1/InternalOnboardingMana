"use client"

import { useTransition } from "react"
import { signOut } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 cursor-pointer px-4"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
    >
      {pending ? "Signing out" : "Sign out"}
    </Button>
  )
}
