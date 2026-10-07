"use client"

import { internName, type Profile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type ClaimDialogMode = "claim" | "takeover" | "unclaim"

export function ClaimManagerDialog({
  open,
  onOpenChange,
  intern,
  currentManagerName,
  mode,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  intern: Profile
  currentManagerName?: string
  mode: ClaimDialogMode
  pending: boolean
  onConfirm: () => void
}) {
  const name = internName(intern)
  const copy = dialogCopy(name, currentManagerName, mode)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 cursor-pointer px-4"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            className="h-11 cursor-pointer px-4"
            onClick={onConfirm}
            disabled={pending}
            variant={mode === "unclaim" ? "destructive" : "default"}
          >
            {pending ? copy.pending : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function dialogCopy(name: string, managerName: string | undefined, mode: ClaimDialogMode) {
  if (mode === "unclaim") {
    return {
      title: `Stop managing ${name}?`,
      body: `You will be removed as a manager. Other managers stay, and modules and progress stay as they are.`,
      cancel: "Keep me",
      confirm: "Remove me",
      pending: "Removing...",
    }
  }

  if (mode === "takeover") {
    return {
      title: `Add yourself as a manager?`,
      body: `${name} already reports to ${managerName ?? "other managers"}. Adding yourself does not remove them. You can then send modules and follow progress.`,
      cancel: "Not now",
      confirm: "Add me",
      pending: "Adding...",
    }
  }

  return {
    title: `Assign ${name} to yourself?`,
    body: `${name} does not have a manager yet. Add yourself so you can send modules and follow their progress.`,
    cancel: "Not now",
    confirm: "Assign to me",
    pending: "Assigning...",
  }
}
