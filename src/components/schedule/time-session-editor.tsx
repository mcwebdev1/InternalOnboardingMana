"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { NeedsReviewBadge } from "@/components/schedule/needs-review-badge"
import type { StaffIntern } from "@/components/schedule/team-schedule-grid"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteTimeSession, saveTimeSession } from "@/lib/actions/admin-schedule"
import {
  formatDayLabel,
  formatHoursAsClock,
  toZonedLocalInput,
  zonedLocalToISO,
  type ReportSession,
} from "@/lib/schedule"

type EditorSession = ReportSession & { needsReview: boolean }

export function TimeSessionEditor({
  intern,
  day,
  sessions,
  onClose,
}: {
  intern: StaffIntern
  day: string
  sessions: EditorSession[]
  onClose: () => void
}) {
  const [adding, setAdding] = useState(sessions.length === 0)

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {intern.name}, {formatDayLabel(day)}
          </DialogTitle>
          <DialogDescription className="leading-6">
            Times are New York time. Leave clock out empty to keep a session open. Hours
            are worked out when you save.
          </DialogDescription>
        </DialogHeader>

        {sessions.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground">No sessions on this day.</p>
        ) : null}

        <ul className="space-y-3">
          {sessions.map((session, index) => (
            <SessionForm
              key={`${session.id}:${session.clock_in}:${session.clock_out}`}
              internId={intern.id}
              label={`Session ${index + 1}`}
              session={session}
            />
          ))}
          {adding ? (
            <SessionForm
              internId={intern.id}
              label="New session"
              defaultDay={day}
              onDone={() => setAdding(false)}
            />
          ) : null}
        </ul>

        {!adding ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 cursor-pointer self-start px-4"
            onClick={() => setAdding(true)}
          >
            <Plus />
            Add session
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function previewHours(clockIn: string, clockOut: string) {
  const start = zonedLocalToISO(clockIn)
  const end = zonedLocalToISO(clockOut)
  if (!start || !end) return null
  const hours = (Date.parse(end) - Date.parse(start)) / 3_600_000
  return hours > 0 ? formatHoursAsClock(hours) : null
}

function SessionForm({
  internId,
  label,
  session,
  defaultDay,
  onDone,
}: {
  internId: string
  label: string
  session?: EditorSession
  defaultDay?: string
  onDone?: () => void
}) {
  const initialIn = session ? toZonedLocalInput(session.clock_in) : `${defaultDay}T09:00`
  const initialOut = session
    ? session.clock_out
      ? toZonedLocalInput(session.clock_out)
      : ""
    : `${defaultDay}T17:00`
  const [clockIn, setClockIn] = useState(initialIn)
  const [clockOut, setClockOut] = useState(initialOut)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const changed = !session || clockIn !== initialIn || clockOut !== initialOut
  const duration = previewHours(clockIn, clockOut)
  const fieldId = `${session?.id ?? "new"}`

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await saveTimeSession(internId, session?.id ?? null, { clockIn, clockOut })
      if ("error" in result) {
        setError(result.error)
        return
      }
      toast.success(session ? "Session updated" : "Session added")
      onDone?.()
    })
  }

  function handleDelete() {
    if (!session) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await deleteTimeSession(internId, session.id)
      if ("error" in result) {
        setError(result.error)
        setConfirmDelete(false)
        return
      }
      toast.success("Session deleted")
    })
  }

  return (
    <li className="space-y-3 rounded-xl bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{label}</p>
        {session && !session.clock_out ? (
          <span className="text-xs text-[#4EAD63]">Open</span>
        ) : null}
        {session?.needsReview ? <NeedsReviewBadge /> : null}
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {duration ? `${duration} worked` : clockOut ? "" : "Still open"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`clock-in-${fieldId}`}>Clock in</Label>
          <Input
            id={`clock-in-${fieldId}`}
            type="datetime-local"
            value={clockIn}
            onChange={(event) => {
              setClockIn(event.target.value)
              setConfirmDelete(false)
            }}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`clock-out-${fieldId}`}>Clock out</Label>
          <Input
            id={`clock-out-${fieldId}`}
            type="datetime-local"
            value={clockOut}
            onChange={(event) => {
              setClockOut(event.target.value)
              setConfirmDelete(false)
            }}
            className="h-11"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-11 cursor-pointer px-4"
          disabled={pending || !changed}
          onClick={handleSave}
        >
          {pending ? "Saving..." : session ? "Save changes" : "Add session"}
        </Button>
        {session ? (
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "outline"}
            className="h-11 cursor-pointer px-4"
            disabled={pending}
            onClick={handleDelete}
          >
            {confirmDelete ? "Confirm delete" : "Delete"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="h-11 cursor-pointer px-4"
            disabled={pending}
            onClick={onDone}
          >
            Cancel
          </Button>
        )}
      </div>
    </li>
  )
}
