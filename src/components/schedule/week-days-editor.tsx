"use client"

import { Lock } from "lucide-react"
import { ScheduleStatusLabel } from "@/components/schedule/schedule-status-label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SCHEDULE_STATUSES,
  STATUS_COLORS,
  WEEKDAY_LABELS,
  formatDateLabel,
  formatTimeRange,
  requiresTimeRange,
  toTimeInput,
  weekDays,
  type ScheduleDayInput,
} from "@/lib/schedule"
import type { ScheduleStatus } from "@/lib/types"

export type SavedScheduleDay = {
  day: string
  status: ScheduleStatus
  start_time: string | null
  end_time: string | null
}

export type Draft = {
  status: ScheduleStatus | ""
  startTime: string
  endTime: string
}

export const EMPTY_DRAFT: Draft = { status: "", startTime: "", endTime: "" }

export function draftFromSaved(row: SavedScheduleDay | null | undefined): Draft {
  if (!row) return EMPTY_DRAFT
  return {
    status: row.status,
    startTime: toTimeInput(row.start_time),
    endTime: toTimeInput(row.end_time),
  }
}

export function sameDraft(a: Draft, b: Draft) {
  return a.status === b.status && a.startTime === b.startTime && a.endTime === b.endTime
}

export function toEntry(day: string, draft: Draft): ScheduleDayInput {
  const timed = draft.status !== "" && requiresTimeRange(draft.status)
  return {
    day,
    status: draft.status,
    startTime: timed ? draft.startTime : null,
    endTime: timed ? draft.endTime : null,
  }
}

// Picking Available or Remote fills in a default range; the others clear it.
export function withStatus(draft: Draft, status: ScheduleStatus): Draft {
  if (requiresTimeRange(status)) {
    return {
      status,
      startTime: draft.startTime || "09:00",
      endTime: draft.endTime || "17:00",
    }
  }
  return { status, startTime: "", endTime: "" }
}

// One row per weekday with a status picker and, for Available and Remote,
// a start and end time. Days before `lockedBefore` are read only.
export function WeekDaysEditor({
  weekStart,
  draftFor,
  onChange,
  today,
  lockedBefore,
  isDirty,
}: {
  weekStart: string
  draftFor: (day: string) => Draft
  onChange: (day: string, draft: Draft) => void
  today?: string
  lockedBefore?: string
  isDirty?: (day: string) => boolean
}) {
  return (
    <ul className="space-y-2" aria-label={`Week of ${formatDateLabel(weekStart)}`}>
      {weekDays(weekStart).map((day, index) => {
        const draft = draftFor(day)
        const locked = lockedBefore !== undefined && day < lockedBefore
        const label = `${WEEKDAY_LABELS[index]}, ${formatDateLabel(day)}`
        const timed = draft.status !== "" && requiresTimeRange(draft.status)

        return (
          <li
            key={day}
            className="grid gap-3 rounded-xl border-l-4 bg-muted/30 py-3 pr-3 pl-4 sm:grid-cols-[9rem_12rem_minmax(0,1fr)] sm:items-center"
            style={{
              borderLeftColor: draft.status ? STATUS_COLORS[draft.status] : "transparent",
            }}
          >
            <div>
              <p className="font-medium">{WEEKDAY_LABELS[index]}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateLabel(day)}
                {day === today ? " · Today" : ""}
                {isDirty?.(day) ? " · Unsaved" : ""}
              </p>
            </div>

            {locked ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:col-span-2">
                {draft.status ? (
                  <ScheduleStatusLabel status={draft.status} />
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
                {draft.startTime && draft.endTime ? (
                  <span className="text-muted-foreground">
                    {formatTimeRange(draft.startTime, draft.endTime)}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3" />
                  Past day
                </span>
              </div>
            ) : (
              <>
                <Select
                  value={draft.status}
                  onValueChange={(value) =>
                    onChange(day, withStatus(draft, value as ScheduleStatus))
                  }
                >
                  <SelectTrigger
                    aria-label={`Status for ${label}`}
                    className="w-full cursor-pointer data-[size=default]:h-11"
                  >
                    <SelectValue placeholder="Choose status" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_STATUSES.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="min-h-11 cursor-pointer"
                      >
                        <ScheduleStatusLabel status={option.value} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {timed ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      aria-label={`Start time for ${label}`}
                      value={draft.startTime}
                      onChange={(event) =>
                        onChange(day, { ...draft, startTime: event.target.value })
                      }
                      className="h-11 min-w-0"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      aria-label={`End time for ${label}`}
                      value={draft.endTime}
                      onChange={(event) =>
                        onChange(day, { ...draft, endTime: event.target.value })
                      }
                      className="h-11 min-w-0"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {draft.status ? "No hours" : "Choose a status first"}
                  </p>
                )}
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}
