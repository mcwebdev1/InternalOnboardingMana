import assert from "node:assert/strict"
import { describe, test } from "node:test"
import {
  addDays,
  buildWeekReport,
  hoursWorkedToday,
  isUUID,
  normalizeWeekParam,
  sessionNeedsReview,
  toZonedLocalInput,
  validateSessionInput,
  zonedLocalToISO,
  isISODate,
  isWeekSet,
  isoWeekday,
  localToday,
  scheduleWeekStarts,
  scheduleWindowEnd,
  upcomingWeekStart,
  validateScheduleSubmission,
  weekDays,
  weekStartOf,
} from "./schedule.ts"

const TODAY = "2026-10-22" // Thursday

function week(weekStart, status = "available") {
  return weekDays(weekStart).map((day) => ({
    day,
    status,
    startTime: status === "available" || status === "remote" ? "09:00" : null,
    endTime: status === "available" || status === "remote" ? "17:00" : null,
  }))
}

function rest(entries, fromDay) {
  return entries.filter((entry) => entry.day >= fromDay)
}

describe("week math", () => {
  test("localToday uses New York, not the server clock", () => {
    // 23:59 EDT on Oct 22 is already Oct 23 in UTC.
    assert.equal(localToday(new Date("2026-10-23T03:59:00Z")), "2026-10-22")
    assert.equal(localToday(new Date("2026-10-23T04:00:00Z")), "2026-10-23")
  })

  test("localToday handles the November daylight saving change", () => {
    // Still EDT (UTC-4) late on Saturday Oct 31.
    assert.equal(localToday(new Date("2026-11-01T03:30:00Z")), "2026-10-31")
    // EST (UTC-5) after clocks fall back on Sunday Nov 1.
    assert.equal(localToday(new Date("2026-11-02T04:30:00Z")), "2026-11-01")
    assert.equal(localToday(new Date("2026-11-02T05:00:00Z")), "2026-11-02")
  })

  test("localToday handles the March daylight saving change", () => {
    assert.equal(localToday(new Date("2026-03-08T04:30:00Z")), "2026-03-07")
    assert.equal(localToday(new Date("2026-03-09T03:30:00Z")), "2026-03-08")
    assert.equal(localToday(new Date("2026-03-09T04:30:00Z")), "2026-03-09")
  })

  test("week steps across a daylight saving change stay on Mondays", () => {
    assert.equal(addDays("2026-10-26", 7), "2026-11-02")
    assert.equal(addDays("2026-03-02", 7), "2026-03-09")
    assert.equal(isoWeekday("2026-11-02"), 1)
    assert.equal(isoWeekday("2026-03-09"), 1)
    assert.deepEqual(weekDays("2026-11-02"), [
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ])
  })

  test("weekStartOf returns the Monday of the same week", () => {
    assert.equal(weekStartOf("2026-11-01"), "2026-10-26") // Sunday of the DST change
    assert.equal(weekStartOf("2026-03-07"), "2026-03-02") // Saturday before DST
    assert.equal(weekStartOf("2026-03-09"), "2026-03-09")
    assert.equal(weekStartOf("2026-10-22"), "2026-10-19")
  })

  test("upcomingWeekStart is the next Monday after the current week", () => {
    assert.equal(upcomingWeekStart("2026-10-22"), "2026-10-26")
    assert.equal(upcomingWeekStart("2026-10-25"), "2026-10-26") // Sunday
    assert.equal(upcomingWeekStart("2026-10-26"), "2026-11-02") // Monday
  })

  test("the window is the current week plus 8 weeks and spans DST", () => {
    const weeks = scheduleWeekStarts(TODAY)
    assert.equal(weeks.length, 9)
    assert.equal(weeks[0], "2026-10-19")
    assert.equal(weeks[2], "2026-11-02")
    assert.equal(weeks[8], "2026-12-14")
    assert.ok(weeks.every((weekStart) => isoWeekday(weekStart) === 1))
    assert.equal(scheduleWindowEnd(TODAY), "2026-12-18")
  })

  test("isISODate rejects impossible dates", () => {
    assert.equal(isISODate("2026-02-30"), false)
    assert.equal(isISODate("2026-10-22"), true)
    assert.equal(isISODate("10/22/2026"), false)
  })

  test("isWeekSet needs all five weekdays", () => {
    const days = weekDays("2026-10-26")
    assert.equal(isWeekSet(days, "2026-10-26"), true)
    assert.equal(isWeekSet(days.slice(0, 4), "2026-10-26"), false)
  })

  test("hoursWorkedToday adds closed sessions and the running one", () => {
    const now = new Date("2026-10-22T18:30:00Z").getTime()
    const hours = hoursWorkedToday(
      [
        { work_date: TODAY, clock_in: "2026-10-22T13:00:00Z", clock_out: "2026-10-22T15:00:00Z", actual_hours: 2 },
        { work_date: TODAY, clock_in: "2026-10-22T18:00:00Z", clock_out: null, actual_hours: null },
        { work_date: "2026-10-21", clock_in: "2026-10-21T13:00:00Z", clock_out: "2026-10-21T21:00:00Z", actual_hours: 8 },
      ],
      TODAY,
      now
    )
    assert.equal(hours, 2.5)
  })
})

describe("validateScheduleSubmission", () => {
  test("accepts the rest of this week plus several later weeks", () => {
    const entries = [
      ...rest(week("2026-10-19"), TODAY),
      ...week("2026-10-26", "remote"),
      ...week("2026-11-02", "out"),
    ]
    const result = validateScheduleSubmission(entries, TODAY)
    assert.equal(result.ok, true)
    assert.equal(result.rows.length, 12)
    assert.deepEqual(result.rows[0], {
      day: "2026-10-22",
      status: "available",
      start_time: "09:00",
      end_time: "17:00",
    })
    assert.deepEqual(result.rows.at(-1), {
      day: "2026-11-06",
      status: "out",
      start_time: null,
      end_time: null,
    })
  })

  test("accepts the last week in the window", () => {
    assert.equal(validateScheduleSubmission(week("2026-12-14"), TODAY).ok, true)
  })

  test("ignores client fields like expected_hours", () => {
    const entries = week("2026-10-26").map((entry) => ({ ...entry, expected_hours: 99 }))
    const result = validateScheduleSubmission(entries, TODAY)
    assert.equal(result.ok, true)
    assert.ok(result.rows.every((row) => !("expected_hours" in row)))
  })

  const rejects = [
    ["an empty list", []],
    ["a non-list", { day: "2026-10-26" }],
    ["a past day", [...week("2026-10-19")]],
    ["a weekend day", [...week("2026-10-26"), { day: "2026-10-31", status: "out" }]],
    ["a week past the window", week("2026-12-21")],
    ["an invalid date", [{ day: "2026-02-30", status: "out" }]],
    ["an unknown status", week("2026-10-26").map((e, i) => (i === 0 ? { ...e, status: "associate" } : e))],
    ["Available with no times", week("2026-10-26").map((e, i) => (i === 0 ? { ...e, startTime: null } : e))],
    ["Remote with end before start", week("2026-10-26", "remote").map((e, i) => (i === 0 ? { ...e, endTime: "08:00" } : e))],
    ["end equal to start", week("2026-10-26").map((e, i) => (i === 0 ? { ...e, endTime: "09:00" } : e))],
    ["a malformed time", week("2026-10-26").map((e, i) => (i === 0 ? { ...e, endTime: "25:00" } : e))],
    ["Unavailable with times", week("2026-10-26", "unavailable").map((e, i) => (i === 0 ? { ...e, startTime: "09:00", endTime: "17:00" } : e))],
    ["Out with a start time", week("2026-10-26", "out").map((e, i) => (i === 0 ? { ...e, startTime: "09:00" } : e))],
    ["a duplicate day", [...week("2026-10-26"), week("2026-10-26")[0]]],
    ["a partial week", week("2026-10-26").slice(0, 3)],
    ["a partial current week", rest(week("2026-10-19"), TODAY).slice(1)],
  ]

  for (const [name, input] of rejects) {
    test(`rejects ${name}`, () => {
      const result = validateScheduleSubmission(input, TODAY)
      assert.equal(result.ok, false)
      assert.equal(typeof result.error, "string")
      assert.ok(!result.error.includes("\u2014"), "copy has no em dash")
    })
  }
})

describe("staff schedule override", () => {
  test("allows past weeks and weeks past the intern window", () => {
    assert.equal(validateScheduleSubmission(week("2026-10-12"), TODAY, { staffOverride: true }).ok, true)
    assert.equal(validateScheduleSubmission(week("2027-03-01"), TODAY, { staffOverride: true }).ok, true)
  })

  test("needs all five days, even in the current week", () => {
    const result = validateScheduleSubmission(rest(week("2026-10-19"), TODAY), TODAY, {
      staffOverride: true,
    })
    assert.equal(result.ok, false)
  })

  test("keeps the status and time rules", () => {
    const bad = week("2026-10-12", "out").map((e, i) => (i === 0 ? { ...e, startTime: "09:00", endTime: "10:00" } : e))
    assert.equal(validateScheduleSubmission(bad, TODAY, { staffOverride: true }).ok, false)
    const weekend = [...week("2026-10-12"), { day: "2026-10-17", status: "out" }]
    assert.equal(validateScheduleSubmission(weekend, TODAY, { staffOverride: true }).ok, false)
  })
})

describe("week param and ids", () => {
  test("normalizes any date to its Monday and falls back to this week", () => {
    assert.equal(normalizeWeekParam("2026-10-14", TODAY), "2026-10-12")
    assert.equal(normalizeWeekParam("2026-11-01", TODAY), "2026-10-26")
    assert.equal(normalizeWeekParam("2026-02-30", TODAY), "2026-10-19")
    assert.equal(normalizeWeekParam(undefined, TODAY), "2026-10-19")
    assert.equal(normalizeWeekParam("drop table", TODAY), "2026-10-19")
  })

  test("isUUID only accepts uuids", () => {
    assert.equal(isUUID("0b9f7f1e-6c1a-4c6e-9f43-2b7c1f0b6a11"), true)
    assert.equal(isUUID("intern1"), false)
    assert.equal(isUUID("0b9f7f1e-6c1a-4c6e-9f43-2b7c1f0b6a11' or 1=1"), false)
  })
})

describe("New York time conversion", () => {
  test("converts EDT and EST wall times", () => {
    assert.equal(zonedLocalToISO("2026-10-22T09:00"), "2026-10-22T13:00:00.000Z")
    assert.equal(zonedLocalToISO("2026-12-01T09:00"), "2026-12-01T14:00:00.000Z")
  })

  test("handles the days clocks change", () => {
    // Sunday Nov 1, 2026: 1:00 to 1:59 happens twice. Take the first (EDT).
    assert.equal(zonedLocalToISO("2026-11-01T01:30"), "2026-11-01T05:30:00.000Z")
    assert.equal(zonedLocalToISO("2026-11-01T03:00"), "2026-11-01T08:00:00.000Z")
    // Sunday Mar 8, 2026: 2:00 to 2:59 does not exist.
    assert.equal(zonedLocalToISO("2026-03-08T02:30"), null)
    assert.equal(zonedLocalToISO("2026-03-08T01:59"), "2026-03-08T06:59:00.000Z")
    assert.equal(zonedLocalToISO("2026-03-08T03:00"), "2026-03-08T07:00:00.000Z")
  })

  test("round trips through the editor format", () => {
    for (const iso of ["2026-10-22T13:05:00Z", "2026-11-02T14:00:00Z", "2026-03-09T12:45:00Z"]) {
      assert.equal(zonedLocalToISO(toZonedLocalInput(iso)), new Date(iso).toISOString())
    }
    assert.equal(toZonedLocalInput("2026-10-23T03:30:00Z"), "2026-10-22T23:30")
  })

  test("rejects malformed values", () => {
    for (const value of ["", "2026-10-22", "2026-10-22T24:00", "2026-02-30T09:00", "2026-10-22T09:00Z"]) {
      assert.equal(zonedLocalToISO(value), null, value)
    }
  })
})

describe("validateSessionInput", () => {
  const now = Date.parse("2026-10-22T20:00:00Z") // 4:00 PM EDT

  test("accepts a closed session and an open one", () => {
    assert.deepEqual(validateSessionInput({ clockIn: "2026-10-22T09:00", clockOut: "2026-10-22T12:30" }, now), {
      ok: true,
      clock_in: "2026-10-22T13:00:00.000Z",
      clock_out: "2026-10-22T16:30:00.000Z",
    })
    assert.deepEqual(validateSessionInput({ clockIn: "2026-10-22T09:00", clockOut: "" }, now), {
      ok: true,
      clock_in: "2026-10-22T13:00:00.000Z",
      clock_out: null,
    })
  })

  const rejects = [
    ["a missing clock in", { clockOut: "2026-10-22T12:00" }, "Enter a clock in time."],
    ["a skipped DST time", { clockIn: "2026-03-08T02:15" }, null],
    ["clock out before clock in", { clockIn: "2026-10-22T12:00", clockOut: "2026-10-22T11:00" }, "Clock out must be after clock in."],
    ["clock out equal to clock in", { clockIn: "2026-10-22T12:00", clockOut: "2026-10-22T12:00" }, "Clock out must be after clock in."],
    ["a future clock in", { clockIn: "2026-10-22T16:30" }, "Clock in cannot be in the future."],
    ["a future clock out", { clockIn: "2026-10-22T09:00", clockOut: "2026-10-22T17:00" }, "Clock out cannot be in the future."],
    ["a non-string clock out", { clockIn: "2026-10-22T09:00", clockOut: 5 }, "Enter a valid clock out time."],
    ["no input", null, "Enter a clock in time."],
  ]

  for (const [name, input, message] of rejects) {
    test(`rejects ${name}`, () => {
      const result = validateSessionInput(input, now)
      assert.equal(result.ok, false)
      if (message) assert.equal(result.error, message)
    })
  }
})

describe("week report", () => {
  const now = Date.parse("2026-10-22T20:00:00Z") // Thu 4:00 PM EDT
  const session = (id, work_date, clock_in, clock_out, actual_hours) => ({
    id,
    work_date,
    clock_in,
    clock_out,
    actual_hours,
  })

  test("flags a session left open from an earlier day", () => {
    assert.equal(sessionNeedsReview(session("a", "2026-10-21", "2026-10-21T13:00:00Z", null, null), TODAY, now), true)
  })

  test("flags a session longer than 12 hours", () => {
    assert.equal(
      sessionNeedsReview(session("a", "2026-10-20", "2026-10-20T12:00:00Z", "2026-10-21T00:30:00Z", 12.5), TODAY, now),
      true
    )
    // Still open today and already past 12 hours.
    assert.equal(sessionNeedsReview(session("a", TODAY, "2026-10-22T04:30:00Z", null, null), TODAY, now), true)
  })

  test("does not flag normal sessions", () => {
    assert.equal(sessionNeedsReview(session("a", TODAY, "2026-10-22T13:00:00Z", null, null), TODAY, now), false)
    assert.equal(
      sessionNeedsReview(session("a", "2026-10-20", "2026-10-20T13:00:00Z", "2026-10-21T01:00:00Z", 12), TODAY, now),
      false
    )
  })

  test("adds up days and the week, without expected hours", () => {
    const report = buildWeekReport({
      weekStart: "2026-10-19",
      today: TODAY,
      nowMs: now,
      schedules: [
        { day: "2026-10-19", status: "available", start_time: "09:00:00", end_time: "17:00:00" },
        { day: "2026-10-20", status: "out", start_time: null, end_time: null },
      ],
      sessions: [
        session("a", "2026-10-19", "2026-10-19T13:00:00Z", "2026-10-19T16:00:00Z", 3),
        session("b", "2026-10-19", "2026-10-19T17:00:00Z", "2026-10-19T21:30:00Z", 4.5),
        session("c", "2026-10-21", "2026-10-21T13:00:00Z", null, null),
        session("d", TODAY, "2026-10-22T18:30:00Z", null, null),
        session("e", "2026-10-26", "2026-10-26T13:00:00Z", "2026-10-26T14:00:00Z", 1),
      ],
    })

    assert.deepEqual(report.days.map((day) => day.workedHours), [7.5, 0, 0, 1.5, 0])
    assert.equal(report.totalHours, 9)
    assert.deepEqual(report.days.map((day) => day.needsReview), [false, false, true, false, false])
    assert.equal(report.needsReview, true)
    assert.equal(report.days[0].schedule.status, "available")
    assert.equal(report.days[2].schedule, null)
    assert.ok(!JSON.stringify(report).includes("expected"))
  })
})
