import assert from "node:assert/strict"
import { describe, test } from "node:test"
import {
  GOOGLE_NO_ACCESS_MESSAGE,
  decideGoogleAccess,
  oauthErrorMessage,
} from "./google-access.ts"

const vlad = {
  google_email: "vlad@manacommon.com",
  email_verified: true,
  allowlist_role: "admin",
  profile_role: "admin",
  profile_email: "vlad@manacommon.com",
}

describe("decideGoogleAccess", () => {
  test("allows an allowlisted admin and the master", () => {
    assert.deepEqual(decideGoogleAccess(vlad), { allowed: true, role: "admin" })
    assert.deepEqual(
      decideGoogleAccess({
        google_email: "webdev@manacommon.com",
        email_verified: true,
        allowlist_role: "master",
        profile_role: "master",
        profile_email: "webdev@manacommon.com",
      }),
      { allowed: true, role: "master" }
    )
  })

  test("ignores letter case and spaces in emails", () => {
    const result = decideGoogleAccess({
      ...vlad,
      google_email: " Vlad@ManaCommon.COM ",
      profile_email: "vlad@manacommon.com",
    })
    assert.equal(result.allowed, true)
  })

  test("denies an email that is not on the allowlist", () => {
    const result = decideGoogleAccess({
      google_email: "someone@gmail.com",
      email_verified: true,
      allowlist_role: null,
      profile_role: null,
      profile_email: null,
    })
    assert.equal(result.allowed, false)
  })

  test("denies an unverified Google email, even if allowlisted", () => {
    assert.equal(decideGoogleAccess({ ...vlad, email_verified: false }).allowed, false)
    assert.equal(decideGoogleAccess({ ...vlad, email_verified: "true" }).allowed, false)
  })

  test("denies a session with no Google identity, such as a PIN login for an allowlisted address", () => {
    assert.equal(decideGoogleAccess(null).allowed, false)
    assert.equal(decideGoogleAccess(undefined).allowed, false)
    assert.equal(decideGoogleAccess("vlad@manacommon.com").allowed, false)
  })

  test("denies Google linked onto an invited intern profile", () => {
    const result = decideGoogleAccess({
      google_email: "intern.person@gmail.com",
      email_verified: true,
      allowlist_role: null,
      profile_role: "intern",
      profile_email: "intern.person@gmail.com",
    })
    assert.equal(result.allowed, false)
  })

  test("denies when the profile is missing or has another email", () => {
    assert.equal(decideGoogleAccess({ ...vlad, profile_role: null }).allowed, false)
    assert.equal(decideGoogleAccess({ ...vlad, profile_role: "owner" }).allowed, false)
    assert.equal(
      decideGoogleAccess({ ...vlad, profile_email: "marie@manacommon.com" }).allowed,
      false
    )
  })

  test("keeps a role the master changed after the first sign in", () => {
    assert.deepEqual(decideGoogleAccess({ ...vlad, profile_role: "master" }), {
      allowed: true,
      role: "master",
    })
    assert.deepEqual(decideGoogleAccess({ ...vlad, profile_role: "intern" }), {
      allowed: true,
      role: "intern",
    })
  })

  test("never trusts a role that is not admin or master", () => {
    assert.equal(
      decideGoogleAccess({ ...vlad, allowlist_role: "intern", profile_role: "intern" }).allowed,
      false
    )
  })
})

describe("oauthErrorMessage", () => {
  test("turns a rejected sign up into the no access message", () => {
    assert.equal(oauthErrorMessage("Database error saving new user"), GOOGLE_NO_ACCESS_MESSAGE)
    assert.equal(oauthErrorMessage("Unsupported provider"), "Unsupported provider")
  })
})
