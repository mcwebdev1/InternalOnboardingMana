import { AppShell } from "@/components/layout/app-shell"
import { requireAdmin } from "@/lib/auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await requireAdmin()
  return <AppShell profile={profile}>{children}</AppShell>
}
