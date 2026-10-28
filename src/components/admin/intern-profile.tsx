"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, UserMinus, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { claimIntern, setInternManagers, unclaimIntern } from "@/lib/actions/people"
import { saveInternAssignments } from "@/lib/actions/assignments"
import { displayLogin } from "@/lib/login"
import {
  internName,
  isManagedBy,
  isMaster,
  managersLabel,
  type AssignmentStatus,
  type ManagerLink,
  type Module,
  type Profile,
  type UserRole,
} from "@/lib/types"
import {
  ClaimManagerDialog,
  type ClaimDialogMode,
} from "@/components/admin/claim-manager-dialog"
import { ManagerPicker } from "@/components/admin/manager-select"
import { RoleSelect } from "@/components/admin/role-select"
import { StatusBadge } from "@/components/modules/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/empty-state"

type AssignmentView = {
  id: string
  module_id: string
  status: AssignmentStatus
}

export function InternProfile({
  intern,
  internManagersList,
  internManagers,
  modules,
  assignments,
  currentAdminId,
  currentRole,
  managers,
  canChangeRoles,
}: {
  intern: Profile
  internManagersList: Profile[]
  internManagers: ManagerLink[]
  modules: Module[]
  assignments: AssignmentView[]
  currentAdminId: string
  currentRole: UserRole
  managers: Profile[]
  canChangeRoles: boolean
}) {
  const router = useRouter()
  const isMine = isManagedBy(internManagers, intern.id, currentAdminId)
  const canSend = isMine || isMaster(currentRole)
  const hasManagers = internManagersList.length > 0
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<ClaimDialogMode | null>(null)
  const [selected, setSelected] = useState(
    assignments.map((row) => row.module_id)
  )
  const [queuedModuleId, setQueuedModuleId] = useState<string | null>(null)
  const [queuedSave, setQueuedSave] = useState(false)
  const assignmentByModule = new Map(assignments.map((row) => [row.module_id, row]))

  function requestAssignChange(next: () => void, moduleId?: string, shouldSave = false) {
    if (canSend) {
      next()
      return
    }
    setQueuedModuleId(moduleId ?? null)
    setQueuedSave(shouldSave)
    setDialog(hasManagers ? "takeover" : "claim")
  }

  function confirmClaim() {
    startTransition(async () => {
      const result = await claimIntern(intern.id)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(`${internName(intern)} is now on your team`)
      const nextSelected =
        queuedModuleId && !selected.includes(queuedModuleId)
          ? [...selected, queuedModuleId]
          : selected
      if (nextSelected !== selected) setSelected(nextSelected)
      if (queuedSave) {
        const saveResult = await saveInternAssignments(intern.id, nextSelected)
        if ("error" in saveResult) toast.error(saveResult.error)
        else toast.success(`Modules updated for ${internName(intern)}`)
      }
      setQueuedModuleId(null)
      setQueuedSave(false)
      setDialog(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <Link
        href="/admin/people"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to interns
      </Link>

      <section className="flex flex-col gap-4 rounded-2xl bg-card px-5 py-6 ring-1 ring-foreground/10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="text-sm text-muted-foreground">{displayLogin(intern.email)}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {internName(intern)}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Managers: {managersLabel(internManagersList)}
            {isMine ? " (includes you)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canChangeRoles ? <RoleSelect person={intern} /> : null}
          {isMine ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 cursor-pointer px-4"
              disabled={pending}
              onClick={() => setDialog("unclaim")}
            >
              <UserMinus className="size-4" />
              Remove me as manager
            </Button>
          ) : (
            <Button
              type="button"
              className="h-11 cursor-pointer px-4"
              disabled={pending}
              onClick={() => setDialog(hasManagers ? "takeover" : "claim")}
            >
              <UserPlus className="size-4" />
              Assign to me
            </Button>
          )}
        </div>
      </section>

      {isMaster(currentRole) ? (
        <InternManagersEditor
          // Start over when the links change, for example after Assign to me.
          key={internManagersList.map((manager) => manager.id).join(",")}
          intern={intern}
          managers={managers}
          linkedIds={internManagersList.map((manager) => manager.id)}
        />
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Modules and progress</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {canSend
              ? isMine
                ? "Check the modules this intern should see, then save. Progress updates when they mark assigned, started, or finished."
                : "You can send or change modules as master, even if you are not listed as a manager."
              : "You can review progress here. To send or change modules, add yourself as a manager first."}
          </p>
        </div>

        {modules.length === 0 ? (
          <EmptyState
            title="No modules in the library"
            description="Add modules first, then come back to send them to this intern."
            action={{ href: "/admin/modules", label: "Open modules" }}
          />
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              requestAssignChange(() => {
                startTransition(async () => {
                  const result = await saveInternAssignments(intern.id, selected)
                  if ("error" in result) toast.error(result.error)
                  else toast.success(`Modules updated for ${internName(intern)}`)
                })
              }, undefined, true)
            }}
          >
            <ul className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
              {modules.map((module) => {
                const assignment = assignmentByModule.get(module.id)
                const checked = selected.includes(module.id)
                return (
                  <li key={module.id}>
                    <label className="flex cursor-pointer items-start gap-4 px-4 py-4 hover:bg-muted/30">
                      <Checkbox
                        checked={checked}
                        disabled={pending}
                        onCheckedChange={(value) => {
                          requestAssignChange(() => {
                            setSelected((current) =>
                              value
                                ? [...current, module.id]
                                : current.filter((id) => id !== module.id)
                            )
                          }, module.id)
                        }}
                        className="mt-1 size-5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{module.title}</span>
                          {assignment ? (
                            <StatusBadge status={assignment.status} />
                          ) : (
                            <span className="text-xs text-muted-foreground">Not sent</span>
                          )}
                        </span>
                        {module.description ? (
                          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                            {module.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <Button type="submit" className="h-11 cursor-pointer px-5" disabled={pending}>
              {pending
                ? "Saving..."
                : canSend
                  ? "Save modules"
                  : "Assign to me to send modules"}
            </Button>
          </form>
        )}
      </section>

      {dialog ? (
        <ClaimManagerDialog
          open
          intern={intern}
          currentManagerName={managersLabel(internManagersList)}
          mode={dialog}
          pending={pending}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
          onConfirm={() => {
            if (dialog === "unclaim") {
              startTransition(async () => {
                const result = await unclaimIntern(intern.id)
                if ("error" in result) {
                  toast.error(result.error)
                  return
                }
                toast.success(`${internName(intern)} no longer reports to you`)
                setDialog(null)
                router.refresh()
              })
              return
            }
            confirmClaim()
          }}
        />
      ) : null}
    </div>
  )
}

// Master only. Managers add or remove only themselves with Assign to me.
function InternManagersEditor({
  intern,
  managers,
  linkedIds,
}: {
  intern: Profile
  managers: Profile[]
  linkedIds: string[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(linkedIds)
  const [pending, startTransition] = useTransition()
  const changed =
    selected.length !== linkedIds.length || selected.some((id) => !linkedIds.includes(id))

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Managers</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          As master you can link any manager to {internName(intern)}.
        </p>
      </div>
      <ManagerPicker managers={managers} value={selected} onChange={setSelected} />
      <Button
        type="button"
        className="h-11 cursor-pointer px-5"
        disabled={pending || !changed}
        onClick={() => {
          startTransition(async () => {
            const result = await setInternManagers(intern.id, selected)
            if ("error" in result) {
              toast.error(result.error)
              return
            }
            toast.success(`Managers updated for ${internName(intern)}`)
            router.refresh()
          })
        }}
      >
        {pending ? "Saving..." : "Save managers"}
      </Button>
    </section>
  )
}
