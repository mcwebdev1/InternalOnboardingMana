import type { Json } from "@/lib/database.types"

export type InviteCredentials = {
  id: string
  email: string
  pin: string
}

export function parseInviteResult(data: Json | null | undefined): InviteCredentials | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  const id = "id" in data ? data.id : null
  const email = "email" in data ? data.email : null
  const pin = "pin" in data ? data.pin : null
  if (typeof id !== "string" || typeof email !== "string" || typeof pin !== "string") {
    return null
  }
  return { id, email, pin }
}
