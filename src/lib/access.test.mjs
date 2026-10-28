import assert from "node:assert/strict"
import { describe, test } from "node:test"
import {
  canLinkManager,
  canManageIntern,
  isUserRole,
  managerIdsError,
  roleChangeError,
} from "./access.ts"
import { isGoogleMaster } from "./google-access.ts"

const master = { id: "m1", role: "master" }
const admin = { id: "a1", role: "admin" }
const intern = { id: "i1", role: "intern" }

const webdevFacts = {
  google_email: "webdev@manacommon.com",
  email_verified: true,
  allowlist_role: "master",
  profile_role: "master",
  profile_email: "webdev@manacommon.com",
}

describe("canLinkManager", () => {
  test("an admin links only themselves", () => {
    assert.equal(canLinkManager(admin, "a1"), true)
    assert.equal(canLinkManager(admin, "a2"), false)
  })

  test("master links anyone", () => {
    assert.equal(canLinkManager(master, "a2"), true)
    assert.equal(canLinkManager(master, "m1"), true)
  })

  test("an intern links nobody", () => {
    assert.equal(canLinkManager(intern, "i1"), false)
  })
})

describe("managerIdsError", () => {
  test("an admin may add only themselves, or nobody", () => {
    assert.equal(managerIdsError(admin, ["a1"]), null)
    assert.equal(managerIdsError(admin, []), null)
    assert.match(managerIdsError(admin, ["a1", "a2"]), /only add themselves/)
    assert.match(managerIdsError(admin, ["a2"]), /only add themselves/)
  })

  test("master may add any managers", () => {
    assert.equal(managerIdsError(master, ["a1", "a2", "m1"]), null)
  })

  test("interns cannot create accounts", () => {
    assert.match(managerIdsError(intern, []), /Only managers/)
  })
})

describe("canManageIntern", () => {
  test("master manages every intern", () => {
    assert.equal(canManageIntern(master, []), true)
  })

  test("an admin manages only linked interns", () => {
    assert.equal(canManageIntern(admin, ["a1", "a2"]), true)
    assert.equal(canManageIntern(admin, ["a2"]), false)
    assert.equal(canManageIntern(admin, []), false)
  })

  test("an intern manages nobody", () => {
    assert.equal(canManageIntern(intern, ["i1"]), false)
  })
})

describe("isGoogleMaster", () => {
  const webdev = { role: "master", email: "webdev@manacommon.com" }

  test("a master signed in with their allowlisted Google account", () => {
    assert.equal(isGoogleMaster(webdev, webdevFacts), true)
  })

  test("a promoted master counts even if the allowlist says admin", () => {
    const vlad = { role: "master", email: "vlad@manacommon.com" }
    const facts = {
      ...webdevFacts,
      google_email: "vlad@manacommon.com",
      allowlist_role: "admin",
      profile_email: "vlad@manacommon.com",
    }
    assert.equal(isGoogleMaster(vlad, facts), true)
  })

  test("the demo master password login never counts", () => {
    assert.equal(isGoogleMaster({ role: "master", email: "admin@mana.internal" }, null), false)
  })

  test("a demoted account does not count", () => {
    assert.equal(isGoogleMaster({ role: "admin", email: "webdev@manacommon.com" }, webdevFacts), false)
  })

  test("a Google email that differs from the profile does not count", () => {
    assert.equal(
      isGoogleMaster({ role: "master", email: "admin@mana.internal" }, webdevFacts),
      false
    )
  })

  test("an unverified or unlisted Google email does not count", () => {
    assert.equal(isGoogleMaster(webdev, { ...webdevFacts, email_verified: false }), false)
    assert.equal(isGoogleMaster(webdev, { ...webdevFacts, allowlist_role: null }), false)
  })
})

describe("roleChangeError", () => {
  const googleMaster = { ...master, googleMaster: true }

  test("a Google master changes other people's roles, including to master", () => {
    for (const role of ["intern", "admin", "master"]) {
      assert.equal(roleChangeError(googleMaster, "x1", role), null, role)
    }
  })

  test("nobody changes their own role", () => {
    assert.match(roleChangeError(googleMaster, "m1", "admin"), /your own role/)
  })

  test("admins and interns never change roles", () => {
    assert.match(roleChangeError({ ...admin, googleMaster: true }, "x1", "admin"), /Only the master/)
    assert.match(roleChangeError({ ...intern, googleMaster: false }, "x1", "admin"), /Only the master/)
  })

  test("the demo master password login cannot change roles", () => {
    assert.match(roleChangeError({ ...master, googleMaster: false }, "x1", "admin"), /signed in with Google/)
  })

  test("refuses roles that do not exist", () => {
    assert.match(roleChangeError(googleMaster, "x1", "owner"), /Choose/)
    assert.match(roleChangeError(googleMaster, "x1", undefined), /Choose/)
  })
})

describe("isUserRole", () => {
  test("accepts the three roles only", () => {
    assert.equal(isUserRole("intern"), true)
    assert.equal(isUserRole("admin"), true)
    assert.equal(isUserRole("master"), true)
    assert.equal(isUserRole("Master"), false)
    assert.equal(isUserRole(null), false)
  })
})
