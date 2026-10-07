"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  saveAssignmentsForInterns,
  saveInternAssignments,
} from "@/lib/actions/assignments"
import { claimIntern } from "@/lib/actions/people"
import {
  internManagerProfiles,
  internName,
  isManagedBy,
  isMaster,
  managersLabel,
  type ManagerLink,
  type Module,
  type Profile,
  type UserRole,
} from "@/lib/types"
import { InternScopeToggle } from "@/components/admin/intern-scope-toggle"
import {
  ClaimManagerDialog,
  type ClaimDialogMode,
} from "@/components/admin/claim-manager-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"

type AssignmentRow = {
  intern_id: string
  module_id: string
}

export function AssignPanel({
  interns,
  managers,
  internManagers,
  modules,
  assignments,
  currentAdminId,
  currentRole,
}: {
  interns: Profile[]
  managers: Profile[]
  internManagers: ManagerLink[]
  modules: Module[]
  assignments: AssignmentRow[]
  currentAdminId: string
  currentRole: UserRole
}) {
  const router = useRouter()
  const [scope, setScope] = useState<"all" | "mine">("mine")
  const mine = interns.filter((intern) =>
    isManagedBy(internManagers, intern.id, currentAdminId)
  )
  const visible = scope === "mine" ? mine : interns
  const [internId, setInternId] = useState(visible[0]?.id ?? interns[0]?.id ?? "")
  const assignedLookup = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const row of assignments) {
      const current = map.get(row.intern_id) ?? new Set<string>()
      current.add(row.module_id)
      map.set(row.intern_id, current)
    }
    return map
  }, [assignments])

  const [selected, setSelected] = useState<string[]>(
    internId ? Array.from(assignedLookup.get(internId) ?? []) : []
  )
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<ClaimDialogMode | null>(null)

  function changeIntern(nextId: string) {
    setInternId(nextId)
    setSelected(Array.from(assignedLookup.get(nextId) ?? []))
  }

  function changeScope(next: "all" | "mine") {
    setScope(next)
    const nextList = next === "mine" ? mine : interns
    const nextId = nextList.some((intern) => intern.id === internId)
      ? internId
      : (nextList[0]?.id ?? "")
    if (nextId !== internId) changeIntern(nextId)
  }

  if (interns.length === 0) {
    return (
      <EmptyState
        title="No intern accounts yet"
        description="Create intern accounts from Interns, then come back here to send them modules."
        action={{ href: "/admin/people", label: "Create intern accounts" }}
      />
    )
  }

  const currentIntern = interns.find((intern) => intern.id === internId)
  const currentManagers = currentIntern
    ? internManagerProfiles(managers, internManagers, currentIntern.id)
    : []
  const isMine = currentIntern
    ? isManagedBy(internManagers, currentIntern.id, currentAdminId)
    : false
  const canSend = isMine || isMaster(currentRole)
  const hasManagers = currentManagers.length > 0

  function sendToCurrent() {
    if (!currentIntern) return
    startTransition(async () => {
      const result = await saveInternAssignments(currentIntern.id, selected)
      if ("error" in result) toast.error(result.error)
      else toast.success(`Sent to ${internName(currentIntern)}`)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assign modules</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Send modules to an intern on your team. If they report to someone else,
          you can add yourself as another manager first.
        </p>
      </div>

      <InternScopeToggle
        value={scope}
        onChange={changeScope}
        allCount={interns.length}
        mineCount={mine.length}
      />

      {visible.length === 0 ? (
        <EmptyState
          title="None assigned to you"
          description="Switch to All interns and assign someone to yourself, or open their profile from Interns."
          action={{ href: "/admin/people", label: "Open interns" }}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {visible.map((intern) => (
              <button
                key={intern.id}
                type="button"
                onClick={() => changeIntern(intern.id)}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer flex-col items-start justify-center rounded-xl px-4 py-2 text-left text-sm font-medium transition-colors duration-200",
                  intern.id === internId
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{internName(intern)}</span>
                <span
                  className={cn(
                    "text-xs font-normal",
                    intern.id === internId
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  )}
                >
                  {managersLabel(
                    internManagerProfiles(managers, internManagers, intern.id)
                  )}
                </span>
              </button>
            ))}
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!currentIntern) return
              if (canSend) {
                sendToCurrent()
                return
              }
              setDialog(hasManagers ? "takeover" : "claim")
            }}
          >
            <ul className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
              {modules.map((module) => {
                const checked = selected.includes(module.id)
                return (
                  <li key={module.id}>
                    <label className="flex cursor-pointer items-start gap-4 px-4 py-4 hover:bg-muted/30">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          if (!canSend) {
                            setDialog(hasManagers ? "takeover" : "claim")
                            return
                          }
                          setSelected((current) =>
                            value
                              ? [...current, module.id]
                              : current.filter((id) => id !== module.id)
                          )
                        }}
                        className="mt-1 size-5"
                      />
                      <span>
                        <span className="block font-medium">{module.title}</span>
                        <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                          {module.description}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="h-11 cursor-pointer px-5" disabled={pending}>
                {pending
                  ? "Sending..."
                  : canSend
                    ? `Send to ${currentIntern ? internName(currentIntern) : "intern"}`
                    : "Assign to me to send modules"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 cursor-pointer px-5"
                disabled={pending || mine.length === 0}
                onClick={() => {
                  startTransition(async () => {
                    const result = await saveAssignmentsForInterns(
                      mine.map((intern) => intern.id),
                      selected
                    )
                    if ("error" in result) toast.error(result.error)
                    else toast.success("Sent to every intern on your team")
                  })
                }}
              >
                Send to my interns
              </Button>
            </div>
          </form>
        </>
      )}

      {dialog && currentIntern ? (
        <ClaimManagerDialog
          open
          intern={currentIntern}
          currentManagerName={managersLabel(currentManagers)}
          mode={dialog}
          pending={pending}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
          onConfirm={() => {
            startTransition(async () => {
              const result = await claimIntern(currentIntern.id)
              if ("error" in result) {
                toast.error(result.error)
                return
              }
              toast.success(`${internName(currentIntern)} is now on your team`)
              setDialog(null)
              router.refresh()
            })
          }}
        />
      ) : null}
    </div>
  )
}
