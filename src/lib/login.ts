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
