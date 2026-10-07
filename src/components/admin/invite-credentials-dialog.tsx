"use client"

import { displayLogin } from "@/lib/login"
import type { InviteCredentials } from "@/lib/invite"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function InviteCredentialsDialog({
  open,
  onOpenChange,
  title,
  description,
  invite,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  invite: InviteCredentials | null
}) {
  async function copyPin() {
    if (!invite) return
    await navigator.clipboard.writeText(invite.pin)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {invite ? (
          <div className="space-y-3 rounded-xl bg-muted/50 px-4 py-4">
            <p className="text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="mt-1 block font-medium">{displayLogin(invite.email)}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">PIN</span>
              <span className="mt-1 block font-mono text-2xl tracking-[0.3em]">
                {invite.pin}
              </span>
            </p>
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 cursor-pointer px-4"
            onClick={copyPin}
            disabled={!invite}
          >
            Copy PIN
          </Button>
          <Button
            type="button"
            className="h-11 cursor-pointer px-4"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
