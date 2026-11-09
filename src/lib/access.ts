// Pure access rules shared by the server actions and the UI. The database
// enforces the same rules in RLS and triggers (migrations 9 and 10).
// isGoogleMaster lives in google-access.ts.
import type { Profile, UserRole } from "@/lib/types"

type Actor = Pick<Profile, "id" | "role">

export const USER_ROLES: readonly UserRole[] = ["intern", "admin", "master"]

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value)
}

// An admin links or unlinks only themselves. Master links anyone.
export function canLinkManager(actor: Actor, managerId: string) {
  if (actor.role === "master") return true
  return actor.role === "admin" && managerId === actor.id
}

// Error for a new intern's manager list, or null when the actor may use it.
export function managerIdsError(actor: Actor, managerIds: string[]) {
  if (actor.role !== "admin" && actor.role !== "master") {
    return "Only managers can create intern accounts."
  }
  if (managerIds.some((id) => !canLinkManager(actor, id))) {
    return "Managers can only add themselves to a new intern."
  }
  return null
}

// Same rule as private.can_manage_intern(): master manages every intern, an
// admin only interns linked to them.
export function canManageIntern(actor: Actor, linkedManagerIds: string[]) {
  if (actor.role === "master") return true
  return actor.role === "admin" && linkedManagerIds.includes(actor.id)
}

// Error for a role change, or null when it is allowed.
export function roleChangeError(
  actor: Actor & { googleMaster: boolean },
  targetId: string,
  nextRole: unknown,
) {
  if (actor.role !== "master") return "Only the master admin can change roles."
  if (!actor.googleMaster) return "Only a master signed in with Google can change roles."
  if (targetId === actor.id) return "You cannot change your own role."
  if (!isUserRole(nextRole)) return "Choose intern, manager, or master."
  return null
}
