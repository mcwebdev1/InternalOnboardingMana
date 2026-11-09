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
  deleteManagerAccount,
  unclaimIntern,
} from "@/lib/actions/people"
import type { InviteCredentials } from "@/lib/invite"
import { displayLogin, isDemoStaffLogin } from "@/lib/login"
import {
  STATUS_LABELS,
  internManagerProfiles,
  internName,
  isManagedBy,
  isMaster,
  managersLabel,
  roleLabel,
  type ManagerLink,
  type Profile,
  type UserRole,
} from "@/lib/types"
import { ManagerPicker } from "@/components/admin/manager-select"
import { RoleSelect } from "@/components/admin/role-select"
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
  canChangeRoles,
}: {
  people: InternProgress[]
  managers: Profile[]
  internManagers: ManagerLink[]
  currentAdminId: string
  currentRole: UserRole
  canChangeRoles: boolean
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
          <CreateInternDialog
            managers={managers}
            defaultManagerId={currentAdminId}
            canPickManagers={master}
          />
        </div>
      </div>

      {people.length === 0 ? (
        <EmptyState
          title="No intern accounts yet"
          description="Invite an intern with their email. They sign in with that email and a 6-digit PIN."
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
                  canRemove={master || isManagedBy(internManagers, row.intern.id, currentAdminId)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {master ? (
        <ManagersSection
          managers={managers}
          currentAdminId={currentAdminId}
          canChangeRoles={canChangeRoles}
        />
      ) : null}
    </div>
  )
}

function InternRow({
  row,
  managers,
  internManagers,
  currentAdminId,
  canRemove,
}: {
  row: InternProgress
  managers: Profile[]
  internManagers: ManagerLink[]
  currentAdminId: string
  canRemove: boolean
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
        {canRemove ? <DeleteInternButton intern={intern} /> : null}
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
  canPickManagers,
}: {
  managers: Profile[]
  defaultManagerId: string
  canPickManagers: boolean
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
              Use their email. We generate a 6-digit PIN they sign in with.
              {canPickManagers
                ? " Choose one or more managers."
                : " You will be their manager."}
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
                  managerIds: canPickManagers ? managerIds : [defaultManagerId],
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
            {canPickManagers ? (
              <div className="space-y-2">
                <Label>Managers</Label>
                <ManagerPicker
                  managers={managers}
                  value={managerIds}
                  onChange={setManagerIds}
                />
              </div>
            ) : null}
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
        description="Share this email and PIN. The PIN is shown only once."
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
              Use their email. They get a 6-digit PIN to sign in with. Mana
              staff on the Google list sign in with Google and do not need an invite.
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
        description="Share this email and PIN. The PIN is shown only once."
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

function ManagersSection({
  managers,
  currentAdminId,
  canChangeRoles,
}: {
  managers: Profile[]
  currentAdminId: string
  canChangeRoles: boolean
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Managers</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Only the master admin adds and removes managers. Master and demo accounts
          cannot be removed.
          {canChangeRoles
            ? " You can change anyone's role except your own."
            : " Roles can be changed by a master signed in with Google."}
        </p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
        {managers.map((manager) => {
          const locked =
            manager.id === currentAdminId
              ? "You"
              : manager.role === "master"
                ? "Master account"
                : isDemoStaffLogin(manager.email)
                  ? "Demo account"
                  : null
          return (
            <li
              key={manager.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">{internName(manager)}</p>
                <p className="text-sm text-muted-foreground">
                  {displayLogin(manager.email)} · {roleLabel(manager.role)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canChangeRoles && manager.id !== currentAdminId ? (
                  <RoleSelect person={manager} />
                ) : null}
                {locked ? (
                  <span className="text-sm text-muted-foreground">{locked}</span>
                ) : (
                  <RemoveManagerButton manager={manager} />
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function RemoveManagerButton({ manager }: { manager: Profile }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const name = internName(manager)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 cursor-pointer px-4">
          <Trash2 className="size-4" />
          Remove
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {name}?</DialogTitle>
          <DialogDescription className="leading-6">
            Their account is deleted and they lose access right away. Interns they
            managed stay, with any other managers. If they sign in with Google, their
            address stays blocked until it is restored in Supabase.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 cursor-pointer px-4"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Keep manager
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-11 cursor-pointer px-4"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await deleteManagerAccount(manager.id)
                if ("error" in result) {
                  toast.error(result.error)
                  return
                }
                setOpen(false)
                toast.success(`${name} was removed`)
              })
            }}
          >
            {pending ? "Removing..." : "Remove manager"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
