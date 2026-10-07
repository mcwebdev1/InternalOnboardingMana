import { Clock3 } from "lucide-react"

export function ProgressRing({
  value,
  size = 72,
}: {
  value: number
  size?: number
}) {
  const clamped = Math.min(100, Math.max(0, value))
  const stroke = 7
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      aria-label={`${Math.round(clamped)} percent complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="mana-progress" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F5C443" />
            <stop offset="20%" stopColor="#EC8F43" />
            <stop offset="40%" stopColor="#EB4B80" />
            <stop offset="60%" stopColor="#9533B2" />
            <stop offset="80%" stopColor="#5CA1F3" />
            <stop offset="100%" stopColor="#4EAD63" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#mana-progress)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-semibold">
        {Math.round(clamped)}%
      </div>
    </div>
  )
}

export function MinutesLabel({ minutes }: { minutes?: number | null }) {
  if (!minutes) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock3 className="size-3.5" />
      {minutes} min
    </span>
  )
}
