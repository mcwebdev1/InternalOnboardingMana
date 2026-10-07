import { AppHeader } from "@/components/layout/app-header"
import type { Profile } from "@/lib/types"

export function AppShell({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader profile={profile} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  )
}
