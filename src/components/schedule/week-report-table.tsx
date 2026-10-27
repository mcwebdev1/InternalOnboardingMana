"use client"

import Link from "next/link"
import { useState } from "react"
import { NeedsReviewBadge } from "@/components/schedule/needs-review-badge"
import { ScheduleStatusLabel } from "@/components/schedule/schedule-status-label"
import type { StaffIntern } from "@/components/schedule/team-schedule-grid"
import { TimeSessionEditor } from "@/components/schedule/time-session-editor"
import {
  WEEKDAY_LABELS,
  formatDateLabel,
  formatHoursAsClock,
  formatTimeRange,
  weekStartOf,
  type ReportDay,
} from "@/lib/schedule"
import { cn } from "@/lib/utils"

export type InternWeekReport = {
  intern: StaffIntern
  days: ReportDay[]
  totalHours: number
  staleOpenSince: string | null
}

export function WeekReportTable({
  rows,
  today,
}: {
  rows: InternWeekReport[]
  today: string
}) {
  const [selected, setSelected] = useState<{ internId: string; day: string } | null>(null)
  const days = rows[0]?.days.map((day) => day.day) ?? []

  const selectedRow = selected ? rows.find((row) => row.intern.id === selected.internId) : null
  const selectedDay = selected ? selectedRow?.days.find((day) => day.day === selected.day) : null

  return (
    <>
      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium uppercase tracking-wide">
                Intern
              </th>
              {days.map((day, index) => (
                <th
                  key={day}
                  scope="col"
                  className={cn(
                    "px-2 py-3 text-left font-medium",
                    day === today && "text-foreground"
                  )}
                >
                  <span className="uppercase tracking-wide">{WEEKDAY_LABELS[index].slice(0, 3)}</span>{" "}
                  {formatDateLabel(day)}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-medium uppercase tracking-wide">
                Week
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.intern.id}>
                <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                  <p className="font-medium">{row.intern.name}</p>
                  <p className="text-xs text-muted-foreground">{row.intern.login}</p>
                  {row.staleOpenSince ? (
                    <Link
                      href={`/admin/schedule?week=${weekStartOf(row.staleOpenSince)}`}
                      className="mt-1 inline-flex min-h-11 flex-col justify-center gap-1 text-xs text-[#F5C443] hover:underline"
                    >
                      <NeedsReviewBadge />
                      Open since {formatDateLabel(row.staleOpenSince)}
                    </Link>
                  ) : null}
                </th>
                {row.days.map((day) => (
                  <td key={day.day} className="px-2 py-2 align-top">
                    <ReportCell
                      day={day}
                      internName={row.intern.name}
                      onOpen={() => setSelected({ internId: row.intern.id, day: day.day })}
                    />
                  </td>
                ))}
                <td className="px-4 py-3 text-right align-top text-base font-semibold tabular-nums">
                  {formatHoursAsClock(row.totalHours)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRow && selectedDay ? (
        <TimeSessionEditor
          key={`${selectedRow.intern.id}:${selectedDay.day}`}
          intern={selectedRow.intern}
          day={selectedDay.day}
          sessions={selectedDay.sessions}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  )
}

function ReportCell({
  day,
  internName,
  onOpen,
}: {
  day: ReportDay
  internName: string
  onOpen: () => void
}) {
  const { schedule } = day
  const worked = formatHoursAsClock(day.workedHours)

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${internName}, ${formatDateLabel(day.day)}: worked ${worked}. Edit sessions.`}
      className={cn(
        "flex min-h-16 w-full cursor-pointer flex-col items-start gap-1 rounded-lg px-2.5 py-2 text-left ring-1 ring-foreground/5 transition-colors duration-200 hover:bg-muted/60",
        day.needsReview && "ring-[#F5C443]/40"
      )}
    >
      <span className="text-xs text-muted-foreground">
        {schedule?.start_time && schedule.end_time ? (
          formatTimeRange(schedule.start_time.slice(0, 5), schedule.end_time.slice(0, 5))
        ) : schedule ? (
          <ScheduleStatusLabel status={schedule.status} />
        ) : (
          "No schedule"
        )}
      </span>
      <span className="font-medium tabular-nums">{worked} worked</span>
      {day.needsReview ? <NeedsReviewBadge /> : null}
    </button>
  )
}
