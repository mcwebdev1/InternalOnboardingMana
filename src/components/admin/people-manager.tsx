"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Plus, Trash2, UserMinus, UserPlus } from "lucide-react"
import { toast } from "sonner"
import {
  claimIntern,
  createInternAccount,
  createManagerAccount,
  deleteInternAccount,
  unclaimIntern,
} from "@/lib/actions/people"
import type { InviteCredentials } from "@/lib/invite"
import { displayLogin } from "@/lib/login"
import {
  STATUS_LABELS,
  internManagerProfiles,
  internName,
  isManagedBy,
  isMaster,
  managersLabel,
  type ManagerLink,
  type Profile,
  type UserRole,
} from "@/lib/types"
import { ManagerPicker } from "@/components/admin/manager-select"
import { InternScopeToggle } from "@/components/admin/intern-scope-toggle"
import { InviteCredentialsDialog } from "@/components/admin/invite-credentials-dialog"
import {
  ClaimManagerDialog,
  type ClaimDialogMode,
} from "@/components/admin/claim-manager-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/empty-state"

type InternProgress = {
  intern: Profile
  assigned: number
  started: number
  finished: number
}

export function PeopleManager({
  people,
  managers,
  internManagers,
  currentAdminId,
  currentRole,
}: {
  people: InternProgress[]
  managers: Profile[]
  internManagers: ManagerLink[]
  currentAdminId: string
  currentRole: UserRole
}) {
  const [scope, setScope] = useState<"all" | "mine">("all")
  const mine = people.filter(({ intern }) =>
    isManagedBy(internManagers, intern.id, currentAdminId)
  )
  const visible = scope === "mine" ? mine : people
  const master = isMaster(currentRole)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Interns</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Open an intern to see modules and progress. An intern can have more
            than one manager. Add yourself if you own their track.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {master ? <CreateManagerDialog /> : null}
          <CreateInternDialog managers={managers} defaultManagerId={currentAdminId} />
        </div>
      </div>

      {people.length === 0 ? (
        <EmptyState
          title="No intern accounts yet"
          description="Invite an intern with their work email. They get a 6-digit PIN and can also sign in with Google."
        />
      ) : (
        <>
          <InternScopeToggle
            value={scope}
            onChange={setScope}
            allCount={people.length}
            mineCount={mine.length}
          />
          {visible.length === 0 ? (
            <EmptyState
              title="None assigned to you"
              description="Nobody reports to you yet. Switch to All interns, open someone, and add yourself as a manager."
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
              {visible.map((row) => (
                <InternRow
                  key={row.intern.id}
                  row={row}
                  managers={managers}
                  internManagers={internManagers}
                  currentAdminId={currentAdminId}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function InternRow({
  row,
  managers,
  internManagers,
  currentAdminId,
}: {
  row: InternProgress
  managers: Profile[]
  internManagers: ManagerLink[]
  currentAdminId: string
}) {
  const { intern, assigned, started, finished } = row
  const internManagersList = internManagerProfiles(managers, internManagers, intern.id)
  const isMine = isManagedBy(internManagers, intern.id, currentAdminId)

  return (
    <li className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <Link href={`/admin/people/${intern.id}`} className="min-w-0">
        <p className="font-medium transition-colors duration-200 hover:text-foreground">
          {internName(intern)}
        </p>
        <p className="text-sm text-muted-foreground">
          {displayLogin(intern.email)} · {managersLabel(internManagersList)}
        </p>
      </Link>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <ProgressCount label={STATUS_LABELS.not_started} value={assigned} />
        <ProgressCount label={STATUS_LABELS.in_progress} value={started} />
        <ProgressCount label={STATUS_LABELS.completed} value={finished} />
        <ClaimButton
          intern={intern}
          managerName={managersLabel(internManagersList)}
          isMine={isMine}
          hasManagers={internManagersList.length > 0}
        />
        <DeleteInternButton intern={intern} />
      </div>
    </li>
  )
}

function ClaimButton({
  intern,
  managerName,
  isMine,
  hasManagers,
}: {
  intern: Profile
  managerName: string
  isMine: boolean
  hasManagers: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<ClaimDialogMode | null>(null)

  function runClaim() {
    startTransition(async () => {
      const result = await claimIntern(intern.id)
      if ("error" in result) toast.error(result.error)
      else toast.success(`${internName(intern)} is now on your team`)
      setDialog(null)
    })
  }

  return (
    <>
      {isMine ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 cursor-pointer px-3"
          disabled={pending}
          onClick={() => setDialog("unclaim")}
        >
          <UserMinus className="size-4" />
          Remove me
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 cursor-pointer px-3"
          disabled={pending}
          onClick={() => setDialog(hasManagers ? "takeover" : "claim")}
        >
          <UserPlus className="size-4" />
          Assign to me
        </Button>
      )}
      {dialog ? (
        <ClaimManagerDialog
          open
          intern={intern}
          currentManagerName={managerName}
          mode={dialog}
          pending={pending}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
          onConfirm={() => {
            if (dialog === "unclaim") {
              startTransition(async () => {
                const result = await unclaimIntern(intern.id)
                if ("error" in result) toast.error(result.error)
                else toast.success(`${internName(intern)} no longer reports to you`)
                setDialog(null)
              })
              return
            }
            runClaim()
          }}
        />
      ) : null}
    </>
  )
}

function ProgressCount({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-lg bg-muted px-2.5 py-1 text-muted-foreground">
      {value} {label.toLowerCase()}
    </span>
  )
}

function CreateInternDialog({
  managers,
  defaultManagerId,
}: {
  managers: Profile[]
  defaultManagerId: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [managerIds, setManagerIds] = useState<string[]>([defaultManagerId])
  const [invite, setInvite] = useState<InviteCredentials | null>(null)

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setManagerIds([defaultManagerId])
        }}
      >
        <DialogTrigger asChild>
          <Button className="h-11 cursor-pointer px-4">
            <Plus className="size-4" />
            New intern
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite intern</DialogTitle>
            <DialogDescription>
              Use their work email. We generate a 6-digit PIN they can use until
              they sign in with Google. Choose one or more managers.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              startTransition(async () => {
                const result = await createInternAccount({
                  email: String(form.get("email") ?? ""),
                  fullName: String(form.get("full_name") ?? ""),
                  managerIds,
                })
                if ("error" in result) {
                  toast.error(result.error)
                  return
                }
                setOpen(false)
                setInvite(result.invite)
              })
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="text"
                required
                className="h-11"
                placeholder="intern@mana.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" className="h-11" placeholder="Intern 4" />
            </div>
            <div className="space-y-2">
              <Label>Managers</Label>
              <ManagerPicker
                managers={managers}
                value={managerIds}
                onChange={setManagerIds}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="h-11 cursor-pointer px-4" disabled={pending}>
                {pending ? "Creating..." : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <InviteCredentialsDialog
        open={Boolean(invite)}
        onOpenChange={(next) => {
          if (!next) setInvite(null)
        }}
        title="Intern invited"
        description="Share this email and PIN. They should switch to Google sign in with the same email when they can."
        invite={invite}
      />
    </>
  )
}

function CreateManagerDialog() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [invite, setInvite] = useState<InviteCredentials | null>(null)

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="h-11 cursor-pointer px-4">
            <Plus className="size-4" />
            New manager
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite manager</DialogTitle>
            <DialogDescription>
              Use their work email. They get a 6-digit PIN and can sign in with
              Google using that same email.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              startTransition(async () => {
                const result = await createManagerAccount({
                  email: String(form.get("email") ?? ""),
                  fullName: String(form.get("full_name") ?? ""),
                })
                if ("error" in result) {
                  toast.error(result.error)
                  return
                }
                setOpen(false)
                setInvite(result.invite)
              })
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="manager_email">Email</Label>
              <Input
                id="manager_email"
                name="email"
                type="text"
                required
                className="h-11"
                placeholder="manager@mana.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manager_full_name">Full name</Label>
              <Input
                id="manager_full_name"
                name="full_name"
                className="h-11"
                placeholder="Manager name"
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="h-11 cursor-pointer px-4" disabled={pending}>
                {pending ? "Creating..." : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <InviteCredentialsDialog
        open={Boolean(invite)}
        onOpenChange={(next) => {
          if (!next) setInvite(null)
        }}
        title="Manager invited"
        description="Share this email and PIN. They should sign in with Google using the same email when they can."
        invite={invite}
      />
    </>
  )
}

function DeleteInternButton({ intern }: { intern: Profile }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="destructive"
      className="h-11 cursor-pointer px-3"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Remove ${internName(intern)}? Their assignments will be deleted.`)) {
          return
        }
        startTransition(async () => {
          const result = await deleteInternAccount(intern.id)
          if ("error" in result) toast.error(result.error)
          else toast.success("Intern account removed")
        })
      }}
    >
      <Trash2 className="size-4" />
      <span className="sr-only">Remove {internName(intern)}</span>
    </Button>
  )
}
