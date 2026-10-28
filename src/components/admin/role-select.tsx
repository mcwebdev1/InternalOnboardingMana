"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { changeUserRole } from "@/lib/actions/people"
import { USER_ROLES } from "@/lib/access"
import { internName, roleLabel, type Profile, type UserRole } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Master signed in with Google only. The server and database check again.
export function RoleSelect({ person }: { person: Profile }) {
  const [nextRole, setNextRole] = useState<UserRole | null>(null)
  const [pending, startTransition] = useTransition()
  const name = internName(person)

  return (
    <>
      <Select
        value={person.role}
        disabled={pending}
        onValueChange={(value) => {
          if (value !== person.role) setNextRole(value as UserRole)
        }}
      >
        <SelectTrigger
          aria-label={`Role for ${name}`}
          className="w-36 cursor-pointer data-[size=default]:h-11"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {USER_ROLES.map((role) => (
            <SelectItem key={role} value={role} className="min-h-11 cursor-pointer">
              {roleLabel(role)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog
        open={nextRole !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setNextRole(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Make {name} {nextRole ? roleLabel(nextRole).toLowerCase() : ""}?
            </DialogTitle>
            <DialogDescription>{nextRole ? roleChangeCopy(person.role, nextRole) : null}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 cursor-pointer px-4"
              disabled={pending}
              onClick={() => setNextRole(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 cursor-pointer px-4"
              disabled={pending}
              onClick={() => {
                if (!nextRole) return
                startTransition(async () => {
                  const result = await changeUserRole(person.id, nextRole)
                  if ("error" in result) toast.error(result.error)
                  else toast.success(`${name} is now ${roleLabel(nextRole).toLowerCase()}`)
                  setNextRole(null)
                })
              }}
            >
              {pending ? "Saving..." : "Change role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function roleChangeCopy(from: UserRole, to: UserRole) {
  if (from === "intern") {
    return "They stop being an intern and lose their managers. Their modules, schedule and time logs are kept."
  }
  if (to === "intern") {
    return "They stop managing interns and lose staff access. Their Google sign in, if any, keeps working."
  }
  if (to === "master") {
    return "Masters can invite and remove managers, link anyone to any intern, and change roles when signed in with Google."
  }
  return "They keep their interns and lose master access."
}
