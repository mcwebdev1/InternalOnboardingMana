"use client"

import { useState, useTransition } from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { ScheduleStatusLabel } from "@/components/schedule/schedule-status-label"
import {
  WeekDaysEditor,
  draftFromSaved,
  toEntry,
  type Draft,
  type SavedScheduleDay,
} from "@/components/schedule/week-days-editor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { overrideInternSchedule } from "@/lib/actions/admin-schedule"
import {
  STATUS_COLORS,
  WEEKDAY_LABELS,
  addDays,
  formatDateLabel,
  formatTimeRange,
  validateScheduleSubmission,
  weekDays,
} from "@/lib/schedule"
import { cn } from "@/lib/utils"

export type StaffIntern = { id: string; name: string; login: string }

export type InternScheduleDay = SavedScheduleDay & { intern_id: string }

export function TeamScheduleGrid({
  interns,
  weekStart,
  today,
  schedules,
}: {
  interns: StaffIntern[]
  weekStart: string
  today: string
  schedules: InternScheduleDay[]
}) {
  const [editing, setEditing] = useState<StaffIntern | null>(null)
  const days = weekDays(weekStart)
  const rowFor = (internId: string, day: string) =>
    schedules.find((row) => row.intern_id === internId && row.day === day) ?? null

  return (
    <>
      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full min-w-[820px] border-collapse text-sm">
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
                  {day === today ? " · Today" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {interns.map((intern) => (
              <tr key={intern.id}>
                <th scope="row" className="px-4 py-2 text-left align-middle font-normal">
                  <p className="font-medium">{intern.name}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="-ml-3 h-11 cursor-pointer px-3 text-muted-foreground"
                    onClick={() => setEditing(intern)}
                  >
                    <Pencil />
                    Edit schedule
                  </Button>
                </th>
                {days.map((day) => (
                  <td key={day} className="px-2 py-2 align-middle">
                    <ScheduleCell row={rowFor(intern.id, day)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <ScheduleOverrideDialog
          key={`${editing.id}:${weekStart}`}
          intern={editing}
          weekStart={weekStart}
          today={today}
          rows={schedules.filter((row) => row.intern_id === editing.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

function ScheduleCell({ row }: { row: SavedScheduleDay | null }) {
  if (!row) {
    return (
      <div className="flex min-h-11 items-center rounded-lg border border-dashed border-border px-2.5 text-xs text-muted-foreground">
        Not set
      </div>
    )
  }

  const color = STATUS_COLORS[row.status]
  return (
    <div
      className="flex min-h-11 flex-col justify-center rounded-lg border-l-4 px-2.5 py-1.5"
      style={{ borderLeftColor: color, backgroundColor: `${color}1f` }}
    >
      <ScheduleStatusLabel status={row.status} className="text-sm font-medium" />
      {row.start_time && row.end_time ? (
        <span className="text-xs text-muted-foreground">
          {formatTimeRange(row.start_time.slice(0, 5), row.end_time.slice(0, 5))}
        </span>
      ) : null}
    </div>
  )
}

function ScheduleOverrideDialog({
  intern,
  weekStart,
  today,
  rows,
  onClose,
}: {
  intern: StaffIntern
  weekStart: string
  today: string
  rows: SavedScheduleDay[]
  onClose: () => void
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      weekDays(weekStart).map((day) => [day, draftFromSaved(rows.find((row) => row.day === day))])
    )
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isPastWeek = addDays(weekStart, 4) < today

  function handleSave() {
    const entries = weekDays(weekStart).map((day) => toEntry(day, drafts[day]))
    const check = validateScheduleSubmission(entries, today, { staffOverride: true })
    if (!check.ok) {
      setError(check.error)
      return
    }

    startTransition(async () => {
      const result = await overrideInternSchedule(intern.id, weekStart, entries)
      if ("error" in result) {
        setError(result.error)
        return
      }
      toast.success(`Schedule updated for ${intern.name}`)
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {intern.name}, week of {formatDateLabel(weekStart)}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {isPastWeek
              ? "This week has passed. Your changes replace what the intern set."
              : "Your changes replace what the intern set for this week."}{" "}
            Set all five days. Available and Remote need a start and end time.
          </DialogDescription>
        </DialogHeader>

        <WeekDaysEditor
          weekStart={weekStart}
          today={today}
          draftFor={(day) => drafts[day]}
          onChange={(day, draft) => {
            setError(null)
            setDrafts((prev) => ({ ...prev, [day]: draft }))
          }}
        />

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 cursor-pointer px-4"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-11 cursor-pointer px-4"
            disabled={pending}
            onClick={handleSave}
          >
            {pending ? "Saving..." : "Save schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
