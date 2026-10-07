import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/auth"
import { isStaff } from "@/lib/types"

export default async function Home() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  if (isStaff(profile.role)) redirect("/admin")
  redirect("/onboarding")
}
