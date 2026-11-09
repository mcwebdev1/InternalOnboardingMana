"use client"

import { useEffect, useState, useTransition } from "react"
import { Clock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { clockIn, clockOut } from "@/lib/actions/time-logs"
import {
  formatClockDateTime,
  formatClockTime,
  formatHoursAsClock,
  hoursWorkedToday,
} from "@/lib/schedule"
import { cn } from "@/lib/utils"

type Session = {
  work_date: string
  clock_in: string
  clock_out: string | null
  actual_hours: number | null
}

export function ClockCard({
  sessions,
  today,
  serverNow,
  className,
}: {
  sessions: Session[]
  today: string
  serverNow: number
  className?: string
}) {
  const [pending, startTransition] = useTransition()
  // Starts from the server's clock so the first client render matches.
  const [now, setNow] = useState(serverNow)

  const openSession = sessions.find((session) => session.clock_out === null) ?? null
  const worked = hoursWorkedToday(sessions, today, now)

  useEffect(() => {
    if (!openSession) return
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [openSession])

  function handleClick() {
    startTransition(async () => {
      const result = openSession ? await clockOut() : await clockIn()
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setNow(Date.now())
      toast.success(openSession ? "Clocked out" : "Clocked in")
    })
  }

  const since = openSession
    ? openSession.work_date === today
      ? formatClockTime(openSession.clock_in)
      : formatClockDateTime(openSession.clock_in)
    : null

  return (
    <Card className={cn("bg-card/80", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="size-4 text-muted-foreground" />
          Time clock
        </CardTitle>
        <CardDescription>
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "size-2.5 rounded-full",
                openSession ? "bg-[#4EAD63]" : "bg-muted-foreground/50"
              )}
            />
            {openSession ? `Clocked in since ${since}` : "Not clocked in"}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Worked{" "}
          <span className="text-2xl font-semibold tabular-nums tracking-tight">
            {formatHoursAsClock(worked)}
          </span>{" "}
          today
        </p>
        <Button
          type="button"
          variant={openSession ? "outline" : "default"}
          className="h-11 w-full cursor-pointer"
          disabled={pending}
          onClick={handleClick}
        >
          {pending
            ? openSession
              ? "Clocking out..."
              : "Clocking in..."
            : openSession
              ? "Clock out"
              : "Clock in"}
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          Times use New York time. Ask your manager to fix a session you forgot to close.
        </p>
      </CardContent>
    </Card>
  )
}
