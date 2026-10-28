// Shared schedule rules for the server actions, pages, and client editor.
// Pure functions only: no Supabase or path-alias runtime imports, so the
// tests can run this file directly with node --test.
import type { ScheduleStatus } from "@/lib/types"

// Must match private.app_timezone() in supabase/migrations.
export const APP_TIMEZONE = "America/New_York"

export const MAX_WEEKS_OUT = 8

export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const

export const SCHEDULE_STATUSES: { value: ScheduleStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "remote", label: "Remote" },
  { value: "unavailable", label: "Unavailable" },
  { value: "out", label: "Out" },
]

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  available: "Available",
  remote: "Remote",
  unavailable: "Unavailable",
  out: "Out",
}

export const STATUS_COLORS: Record<ScheduleStatus, string> = {
  available: "#4EAD63",
  remote: "#F5C443",
  unavailable: "#EB4B80",
  out: "#5CA1F3",
}

// Available and Remote are scheduled work and carry a time range.
export const WORKING_STATUSES: readonly ScheduleStatus[] = ["available", "remote"]

export function isScheduleStatus(value: unknown): value is ScheduleStatus {
  return typeof value === "string" && value in SCHEDULE_STATUS_LABELS
}

export function requiresTimeRange(status: ScheduleStatus) {
  return WORKING_STATUSES.includes(status)
}

// Calendar dates are "YYYY-MM-DD" strings. Arithmetic runs in UTC so it never
// shifts across a daylight saving change, whatever timezone the server uses.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function toUTCDate(iso: string) {
  const match = ISO_DATE.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

function fromUTCDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function isISODate(value: unknown): value is string {
  return typeof value === "string" && toUTCDate(value) !== null
}

export function addDays(iso: string, days: number) {
  const date = toUTCDate(iso)
  if (!date) throw new Error(`Invalid date: ${iso}`)
  date.setUTCDate(date.getUTCDate() + days)
  return fromUTCDate(date)
}

// 1 = Monday ... 7 = Sunday, matching Postgres isodow.
export function isoWeekday(iso: string) {
  const date = toUTCDate(iso)
  if (!date) throw new Error(`Invalid date: ${iso}`)
  return ((date.getUTCDay() + 6) % 7) + 1
}

export function weekStartOf(iso: string) {
  return addDays(iso, 1 - isoWeekday(iso))
}

export function weekDays(weekStart: string) {
  return WEEKDAY_LABELS.map((_, index) => addDays(weekStart, index))
}

// Today's calendar date in APP_TIMEZONE, matching private.local_today().
export function localToday(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

// The week after the one containing today. On a weekend this is the
// Monday that is coming up.
export function upcomingWeekStart(today: string) {
  return addDays(weekStartOf(today), 7)
}

// Friday of the week MAX_WEEKS_OUT weeks after the current one, matching
// private.schedule_window_end().
export function scheduleWindowEnd(today: string) {
  return addDays(weekStartOf(today), MAX_WEEKS_OUT * 7 + 4)
}

// The current week plus MAX_WEEKS_OUT weeks.
export function scheduleWeekStarts(today: string) {
  const first = weekStartOf(today)
  return Array.from({ length: MAX_WEEKS_OUT + 1 }, (_, index) =>
    addDays(first, index * 7)
  )
}

export function isEditableDay(day: string, today: string) {
  return (
    isISODate(day) &&
    isoWeekday(day) <= 5 &&
    day >= today &&
    day <= scheduleWindowEnd(today)
  )
}

export function formatDateLabel(
  iso: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
) {
  const date = toUTCDate(iso)
  if (!date) return iso
  return date.toLocaleDateString("en-US", { ...options, timeZone: "UTC" })
}

export function formatDayLabel(iso: string) {
  return formatDateLabel(iso, { weekday: "long", month: "short", day: "numeric" })
}

export function formatClockTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatClockDateTime(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatTimeOfDay(time: string) {
  const [hour, minute] = time.split(":").map(Number)
  const period = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`
}

export function formatTimeRange(startTime: string, endTime: string) {
  return `${formatTimeOfDay(startTime)} to ${formatTimeOfDay(endTime)}`
}

// Decimal hours as "H:MM", so short sessions still show minutes.
export function formatHoursAsClock(hours: number) {
  const totalMinutes = Math.max(0, Math.round(hours * 60))
  const wholeHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${wholeHours}:${String(minutes).padStart(2, "0")}`
}

export function hoursBetween(start: string, endMs: number) {
  return Math.max(0, (endMs - new Date(start).getTime()) / 3_600_000)
}

// Hours worked on `today`: closed sessions plus the running one, if it
// started today.
export function hoursWorkedToday(
  sessions: { work_date: string; clock_in: string; clock_out: string | null; actual_hours: number | null }[],
  today: string,
  nowMs: number
) {
  return sessions
    .filter((session) => session.work_date === today)
    .reduce(
      (total, session) =>
        total +
        (session.clock_out
          ? Number(session.actual_hours ?? 0)
          : hoursBetween(session.clock_in, nowMs)),
      0
    )
}

// Database time values come back as "HH:MM:SS".
export function toTimeInput(value: string | null) {
  return value ? value.slice(0, 5) : ""
}

export type ScheduleDayInput = {
  day: string
  status: string
  startTime?: string | null
  endTime?: string | null
}

export type ScheduleDayRow = {
  day: string
  status: ScheduleStatus
  start_time: string | null
  end_time: string | null
}

export type ScheduleValidation =
  | { ok: true; rows: ScheduleDayRow[] }
  | { ok: false; error: string }

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_DAYS = (MAX_WEEKS_OUT + 1) * WEEKDAY_LABELS.length

// Validates a schedule submission for one or more weeks. Every week that
// appears must include all of its days from today on. Used by the server
// action as the real check and by the editor for early feedback.
// Staff overrides skip the past-day and window limits and must include all
// five weekdays of each week.
export function validateScheduleSubmission(
  input: unknown,
  today: string,
  { staffOverride = false }: { staffOverride?: boolean } = {}
): ScheduleValidation {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "Nothing to save." }
  }
  if (input.length > MAX_DAYS) {
    return { ok: false, error: "Too many days in one save." }
  }

  const windowEnd = scheduleWindowEnd(today)
  const rows: ScheduleDayRow[] = []
  const seen = new Set<string>()

  for (const entry of input as ScheduleDayInput[]) {
    if (!entry || typeof entry !== "object" || !isISODate(entry.day)) {
      return { ok: false, error: "One of the days is not a valid date." }
    }

    const { day } = entry
    const label = formatDayLabel(day)

    if (isoWeekday(day) > 5) {
      return { ok: false, error: `${label} is a weekend. Only weekdays can be scheduled.` }
    }
    if (!staffOverride && day < today) {
      return { ok: false, error: `${label} has passed and can no longer be changed.` }
    }
    if (!staffOverride && day > windowEnd) {
      return {
        ok: false,
        error: `${label} is more than ${MAX_WEEKS_OUT} weeks out.`,
      }
    }
    if (seen.has(day)) {
      return { ok: false, error: `${label} appears more than once.` }
    }
    seen.add(day)

    if (!isScheduleStatus(entry.status)) {
      return { ok: false, error: `Choose a status for ${label}.` }
    }

    const startTime = entry.startTime ?? ""
    const endTime = entry.endTime ?? ""

    if (requiresTimeRange(entry.status)) {
      if (!TIME.test(startTime) || !TIME.test(endTime)) {
        return { ok: false, error: `Set a start and end time for ${label}.` }
      }
      if (endTime <= startTime) {
        return { ok: false, error: `End time must be after start time for ${label}.` }
      }
      rows.push({ day, status: entry.status, start_time: startTime, end_time: endTime })
    } else {
      if (startTime !== "" || endTime !== "") {
        return {
          ok: false,
          error: `${SCHEDULE_STATUS_LABELS[entry.status]} days have no times. Clear the times for ${label}.`,
        }
      }
      rows.push({ day, status: entry.status, start_time: null, end_time: null })
    }
  }

  for (const weekStart of new Set(rows.map((row) => weekStartOf(row.day)))) {
    const missing = weekDays(weekStart).find(
      (day) => (staffOverride || day >= today) && !seen.has(day)
    )
    if (missing) {
      return {
        ok: false,
        error: `Set every remaining day in the week of ${formatDateLabel(weekStart)}. ${formatDayLabel(missing)} is missing.`,
      }
    }
  }

  rows.sort((a, b) => a.day.localeCompare(b.day))
  return { ok: true, rows }
}

// A week counts as set when every weekday has a saved row.
export function isWeekSet(savedDays: Iterable<string>, weekStart: string) {
  const days = new Set(savedDays)
  return weekDays(weekStart).every((day) => days.has(day))
}

// ?week=YYYY-MM-DD from the URL, normalized to its Monday. Anything else
// falls back to the current week. Past weeks are allowed.
export function normalizeWeekParam(value: unknown, today: string) {
  return isISODate(value) ? weekStartOf(value) : weekStartOf(today)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUUID(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value)
}

// Wall-clock values for the session editor are "YYYY-MM-DDTHH:MM" in
// APP_TIMEZONE, whatever timezone the browser or server runs in.
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/

const zonedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

export function toZonedLocalInput(timestamp: string | number) {
  const parts = zonedFormatter.formatToParts(new Date(timestamp))
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`
}

function wallClockMs(local: string) {
  const match = LOCAL_DATE_TIME.exec(local)
  if (!match || !isISODate(match[1])) return null
  const [year, month, day] = match[1].split("-").map(Number)
  return Date.UTC(year, month - 1, day, Number(match[2]), Number(match[3]))
}

// Converts a New York wall-clock time to a UTC ISO timestamp. Returns null
// for malformed input and for times skipped when clocks spring forward.
// A time repeated when clocks fall back resolves to its first occurrence.
export function zonedLocalToISO(local: string) {
  const wall = wallClockMs(local)
  if (wall === null) return null

  const offsets = new Set(
    [wall - 86_400_000, wall + 86_400_000].map(
      (probe) => (wallClockMs(toZonedLocalInput(probe)) ?? probe) - probe
    )
  )
  const matches = [...offsets]
    .map((offset) => wall - offset)
    .filter((instant) => toZonedLocalInput(instant) === local)
    .sort((a, b) => a - b)

  return matches.length > 0 ? new Date(matches[0]).toISOString() : null
}

export type SessionInput = { clockIn: string; clockOut?: string | null }

export type SessionValidation =
  | { ok: true; clock_in: string; clock_out: string | null }
  | { ok: false; error: string }

// Mirrors the database rules so staff see a clear message before saving:
// valid New York times, clock out after clock in, nothing in the future.
export function validateSessionInput(input: unknown, nowMs: number): SessionValidation {
  const { clockIn, clockOut } = (input ?? {}) as SessionInput
  if (typeof clockIn !== "string" || clockIn === "") {
    return { ok: false, error: "Enter a clock in time." }
  }

  const clockInISO = zonedLocalToISO(clockIn)
  if (!clockInISO) {
    return {
      ok: false,
      error: "That clock in time does not exist in New York. Clocks skip that hour, so pick another time.",
    }
  }

  let clockOutISO: string | null = null
  if (typeof clockOut === "string" && clockOut !== "") {
    clockOutISO = zonedLocalToISO(clockOut)
    if (!clockOutISO) {
      return {
        ok: false,
        error: "That clock out time does not exist in New York. Clocks skip that hour, so pick another time.",
      }
    }
  } else if (clockOut !== undefined && clockOut !== null && clockOut !== "") {
    return { ok: false, error: "Enter a valid clock out time." }
  }

  if (Date.parse(clockInISO) > nowMs) {
    return { ok: false, error: "Clock in cannot be in the future." }
  }
  if (clockOutISO && Date.parse(clockOutISO) > nowMs) {
    return { ok: false, error: "Clock out cannot be in the future." }
  }
  if (clockOutISO && Date.parse(clockOutISO) <= Date.parse(clockInISO)) {
    return { ok: false, error: "Clock out must be after clock in." }
  }

  return { ok: true, clock_in: clockInISO, clock_out: clockOutISO }
}

export const REVIEW_SESSION_HOURS = 12

export type ReportSession = {
  id: string
  work_date: string
  clock_in: string
  clock_out: string | null
  actual_hours: number | null
}

// A forgotten clock-out shows up as a session still open from an earlier
// day, or one that ran longer than REVIEW_SESSION_HOURS.
export function sessionNeedsReview(session: ReportSession, today: string, nowMs: number) {
  if (session.clock_out === null && session.work_date < today) return true
  const endMs = session.clock_out ? Date.parse(session.clock_out) : nowMs
  return endMs - Date.parse(session.clock_in) > REVIEW_SESSION_HOURS * 3_600_000
}

// Closed sessions count their recorded hours. A session open since today
// counts time so far. One left open from an earlier day counts nothing
// until someone reviews it.
export function sessionHours(session: ReportSession, today: string, nowMs: number) {
  if (session.clock_out) {
    return session.actual_hours ?? hoursBetween(session.clock_in, Date.parse(session.clock_out))
  }
  return session.work_date === today ? hoursBetween(session.clock_in, nowMs) : 0
}

export type ReportScheduleDay = {
  day: string
  status: ScheduleStatus
  start_time: string | null
  end_time: string | null
}

export type ReportDay = {
  day: string
  schedule: ReportScheduleDay | null
  sessions: (ReportSession & { needsReview: boolean })[]
  workedHours: number
  needsReview: boolean
}

export function buildWeekReport({
  weekStart,
  schedules,
  sessions,
  today,
  nowMs,
}: {
  weekStart: string
  schedules: ReportScheduleDay[]
  sessions: ReportSession[]
  today: string
  nowMs: number
}) {
  const days: ReportDay[] = weekDays(weekStart).map((day) => {
    const daySessions = sessions
      .filter((session) => session.work_date === day)
      .sort((a, b) => a.clock_in.localeCompare(b.clock_in))
      .map((session) => ({ ...session, needsReview: sessionNeedsReview(session, today, nowMs) }))
    return {
      day,
      schedule: schedules.find((row) => row.day === day) ?? null,
      sessions: daySessions,
      workedHours: daySessions.reduce(
        (total, session) => total + sessionHours(session, today, nowMs),
        0
      ),
      needsReview: daySessions.some((session) => session.needsReview),
    }
  })

  return {
    days,
    totalHours: days.reduce((total, day) => total + day.workedHours, 0),
    needsReview: days.some((day) => day.needsReview),
  }
}
