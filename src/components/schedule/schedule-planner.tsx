"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { CalendarClock, Copy } from "lucide-react"
import { toast } from "sonner"
import {
  EMPTY_DRAFT,
  WeekDaysEditor,
  draftFromSaved,
  sameDraft,
  toEntry,
  type Draft,
  type SavedScheduleDay,
} from "@/components/schedule/week-days-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { saveSchedule } from "@/lib/actions/schedule"
import {
  addDays,
  formatDateLabel,
  isWeekSet,
  validateScheduleSubmission,
  weekDays,
} from "@/lib/schedule"
import { cn } from "@/lib/utils"

export type { SavedScheduleDay }

export function SchedulePlanner({
  today,
  weekStarts,
  upcomingWeek,
  initialWeek,
  savedDays,
  className,
}: {
  today: string
  weekStarts: string[]
  upcomingWeek: string
  initialWeek: string
  savedDays: SavedScheduleDay[]
  className?: string
}) {
  const [selectedWeek, setSelectedWeek] = useState(initialWeek)
  const [edits, setEdits] = useState<Record<string, Draft>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const editorRef = useRef<HTMLDivElement>(null)

  const saved = useMemo(
    () => new Map(savedDays.map((row) => [row.day, draftFromSaved(row)])),
    [savedDays]
  )

  const savedFor = (day: string) => saved.get(day) ?? EMPTY_DRAFT
  const draftFor = (day: string) => edits[day] ?? savedFor(day)
  const isDirty = (day: string) => day in edits && !sameDraft(edits[day], savedFor(day))
  const editableDays = (weekStart: string) => weekDays(weekStart).filter((day) => day >= today)

  const dirtyWeeks = weekStarts.filter((weekStart) => editableDays(weekStart).some(isDirty))
  const upcomingSet = isWeekSet(saved.keys(), upcomingWeek)
  const nextWeek = addDays(selectedWeek, 7)
  const canCopyForward = weekStarts.includes(nextWeek)

  function updateDay(day: string, draft: Draft) {
    setError(null)
    setEdits((prev) => ({ ...prev, [day]: draft }))
  }

  function copyToNextWeek() {
    const from = weekDays(selectedWeek)
    const to = weekDays(nextWeek)
    setError(null)
    setEdits((prev) => {
      const next = { ...prev }
      from.forEach((day, index) => {
        const draft = prev[day] ?? savedFor(day)
        if (draft.status !== "") next[to[index]] = draft
      })
      return next
    })
    setSelectedWeek(nextWeek)
  }

  function openUpcomingWeek() {
    setSelectedWeek(upcomingWeek)
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function handleSave() {
    const entries = dirtyWeeks.flatMap((weekStart) =>
      editableDays(weekStart).map((day) => toEntry(day, draftFor(day)))
    )
    const check = validateScheduleSubmission(entries, today)
    if (!check.ok) {
      setError(check.error)
      return
    }

    startTransition(async () => {
      const result = await saveSchedule(entries)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setEdits({})
      setError(null)
      toast.success(
        dirtyWeeks.length === 1 ? "Schedule saved" : `Saved ${dirtyWeeks.length} weeks`
      )
    })
  }

  function weekState(weekStart: string) {
    if (editableDays(weekStart).some(isDirty)) return "Unsaved"
    const remaining = editableDays(weekStart)
    if (remaining.length === 0) return "Past"
    return remaining.every((day) => saved.has(day)) ? "Set" : "Not set"
  }

  return (
    <div className={cn("space-y-6", className)}>
      {!upcomingSet ? (
        <Card className="bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="size-4 text-[#F5C443]" />
              Set your schedule for the week of {formatDateLabel(upcomingWeek)}
            </CardTitle>
            <CardDescription className="leading-6">
              Pick a status for each day. Available and Remote days need a start and end time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" className="h-11 cursor-pointer px-4" onClick={openUpcomingWeek}>
              Set next week
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card ref={editorRef} className="scroll-mt-24 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">My schedule</CardTitle>
          <CardDescription className="leading-6">
            Edit any week up to {weekStarts.length - 1} weeks out, then save once. Past days are locked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div
            role="group"
            aria-label="Weeks"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {weekStarts.map((weekStart, index) => {
              const selected = weekStart === selectedWeek
              const state = weekState(weekStart)
              return (
                <button
                  key={weekStart}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedWeek(weekStart)}
                  className={cn(
                    "flex min-h-11 shrink-0 cursor-pointer flex-col items-start justify-center rounded-lg px-3 py-1.5 text-left transition-colors duration-200",
                    selected
                      ? "bg-muted text-foreground ring-1 ring-foreground/15"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <span className="text-sm font-medium">
                    {index === 0 ? "This week" : formatDateLabel(weekStart)}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      state === "Unsaved" && "text-[#F5C443]",
                      state === "Not set" && "text-[#EB4B80]",
                      (state === "Set" || state === "Past") && "text-muted-foreground"
                    )}
                  >
                    {state}
                  </span>
                </button>
              )
            })}
          </div>

          <WeekDaysEditor
            weekStart={selectedWeek}
            draftFor={draftFor}
            onChange={updateDay}
            today={today}
            lockedBefore={today}
            isDirty={isDirty}
          />

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {dirtyWeeks.length === 0
                ? "All changes saved."
                : dirtyWeeks.length === 1
                  ? "1 week has unsaved changes."
                  : `${dirtyWeeks.length} weeks have unsaved changes.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {canCopyForward ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 cursor-pointer px-4"
                  disabled={pending}
                  onClick={copyToNextWeek}
                >
                  <Copy />
                  Copy to next week
                </Button>
              ) : null}
              {dirtyWeeks.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 cursor-pointer px-4"
                  disabled={pending}
                  onClick={() => {
                    setEdits({})
                    setError(null)
                  }}
                >
                  Discard
                </Button>
              ) : null}
              <Button
                type="button"
                className="h-11 cursor-pointer px-4"
                disabled={pending || dirtyWeeks.length === 0}
                onClick={handleSave}
              >
                {pending
                  ? "Saving..."
                  : dirtyWeeks.length > 1
                    ? `Save ${dirtyWeeks.length} weeks`
                    : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
