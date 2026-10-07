"use client"

import { displayLogin } from "@/lib/login"
import { internName, type Profile } from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"

export function ManagerPicker({
  managers,
  value,
  onChange,
}: {
  managers: Profile[]
  value: string[]
  onChange: (managerIds: string[]) => void
}) {
  return (
    <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl p-2 ring-1 ring-foreground/10">
      {managers.map((manager) => {
        const checked = value.includes(manager.id)
        return (
          <li key={manager.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40">
              <Checkbox
                checked={checked}
                onCheckedChange={(next) => {
                  onChange(
                    next
                      ? [...value, manager.id]
                      : value.filter((id) => id !== manager.id)
                  )
                }}
                className="size-5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{internName(manager)}</span>
                <span className="block text-xs text-muted-foreground">
                  {displayLogin(manager.email)}
                </span>
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}
