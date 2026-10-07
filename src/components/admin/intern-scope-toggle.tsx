"use client"

import { cn } from "@/lib/utils"

export function InternScopeToggle({
  value,
  onChange,
  allCount,
  mineCount,
}: {
  value: "all" | "mine"
  onChange: (value: "all" | "mine") => void
  allCount: number
  mineCount: number
}) {
  return (
    <div
      role="tablist"
      aria-label="Intern list"
      className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:inline-grid"
    >
      <ScopeButton
        selected={value === "all"}
        onClick={() => onChange("all")}
        label="All interns"
        count={allCount}
      />
      <ScopeButton
        selected={value === "mine"}
        onClick={() => onChange("mine")}
        label="Assigned to me"
        count={mineCount}
      />
    </div>
  )
}

function ScopeButton({
  selected,
  onClick,
  label,
  count,
}: {
  selected: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-200",
        selected
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        {count}
      </span>
    </button>
  )
}
