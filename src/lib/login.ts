const LOGIN_DOMAIN = "mana.internal"

export function resolveLogin(login: string) {
  const value = login.trim().toLowerCase()
  if (!value) return value
  if (value.includes("@")) return value
  return `${value}@${LOGIN_DOMAIN}`
}

export function displayLogin(email: string) {
  return email.replace(new RegExp(`@${LOGIN_DOMAIN}$`, "i"), "")
}

// The demo staff logins that delete_manager refuses to remove. Keep in sync
// with private.delete_manager.
const DEMO_STAFF_LOGINS = ["admin", "admin1", "admin2", "admin3"].map(
  (login) => `${login}@${LOGIN_DOMAIN}`,
)

export function isDemoStaffLogin(email: string) {
  return DEMO_STAFF_LOGINS.includes(email.trim().toLowerCase())
}

// Where to send someone after sign in. Only paths on our own origin are kept;
// anything else, including "/\evil.com" and "//evil.com", becomes "/".
export function safeNextPath(next: string | null | undefined, origin: string) {
  if (!next) return "/"
  let target: URL
  try {
    target = new URL(next, origin)
  } catch {
    return "/"
  }
  if (target.origin !== new URL(origin).origin) return "/"
  const path = target.pathname + target.search + target.hash
  // "/.//evil.com" resolves to the path "//evil.com", which reads as another host.
  return path.startsWith("//") ? "/" : path
}
