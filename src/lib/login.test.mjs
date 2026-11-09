import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { isDemoStaffLogin, safeNextPath } from "./login.ts"

const origin = "https://onboarding.example.com"

describe("safeNextPath", () => {
  test("keeps paths on our origin", () => {
    assert.equal(safeNextPath("/admin/schedule", origin), "/admin/schedule")
    assert.equal(safeNextPath("/schedule?week=2026-10-26", origin), "/schedule?week=2026-10-26")
    assert.equal(safeNextPath(`${origin}/admin`, origin), "/admin")
  })

  test("falls back to / when there is nothing to keep", () => {
    assert.equal(safeNextPath(null, origin), "/")
    assert.equal(safeNextPath(undefined, origin), "/")
    assert.equal(safeNextPath("", origin), "/")
  })

  test("refuses other hosts", () => {
    assert.equal(safeNextPath("/\\evil.com", origin), "/")
    assert.equal(safeNextPath("//evil.com", origin), "/")
    assert.equal(safeNextPath("\\\\evil.com", origin), "/")
    assert.equal(safeNextPath("https://evil.com/admin", origin), "/")
    assert.equal(safeNextPath("http://onboarding.example.com/admin", origin), "/")
    assert.equal(safeNextPath("javascript:alert(1)", origin), "/")
  })

  test("an encoded backslash stays on our origin", () => {
    const next = safeNextPath("/%5Cevil.com", origin)
    assert.equal(next, "/%5Cevil.com")
    assert.equal(new URL(next, origin).origin, origin)
  })

  test("a dot segment cannot produce a protocol-relative path", () => {
    assert.equal(safeNextPath("/.//evil.com", origin), "/")
    assert.equal(safeNextPath("/x/..//evil.com", origin), "/")
  })

  test("every result resolves back to our origin", () => {
    for (const input of ["/\\evil.com", "//evil.com", "/%5Cevil.com", "/.//evil.com", "/ok"]) {
      assert.equal(new URL(safeNextPath(input, origin), origin).origin, origin, input)
    }
  })
})

describe("isDemoStaffLogin", () => {
  test("matches only the four demo staff logins", () => {
    for (const email of ["admin@mana.internal", "ADMIN1@mana.internal", " admin3@mana.internal "]) {
      assert.equal(isDemoStaffLogin(email), true, email)
    }
    for (const email of ["sarah@mana.internal", "intern1@mana.internal", "admin4@mana.internal", "vlad@manacommon.com"]) {
      assert.equal(isDemoStaffLogin(email), false, email)
    }
  })
})
