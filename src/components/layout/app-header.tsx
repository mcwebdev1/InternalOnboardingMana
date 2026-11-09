"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BrandLogo } from "@/components/brand/logo"
import { GradientBar } from "@/components/brand/gradient-bar"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { displayLogin } from "@/lib/login"
import { isStaff, roleLabel, type Profile } from "@/lib/types"
import { cn } from "@/lib/utils"

const internLinks = [
  { href: "/onboarding", label: "My modules" },
  { href: "/schedule", label: "Schedule" },
]

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/people", label: "Interns" },
  { href: "/admin/modules", label: "Modules" },
  { href: "/admin/assign", label: "Assign" },
  { href: "/admin/schedule", label: "Schedule" },
]

export function AppHeader({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const links = isStaff(profile.role) ? adminLinks : internLinks

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-3">
          <BrandLogo size={32} />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Mana Onboarding</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {isStaff(profile.role) ? roleLabel(profile.role) : "Intern workspace"}
            </p>
          </div>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink key={link.href} href={link.href} pathname={pathname} label={link.label} />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">{profile.full_name ?? displayLogin(profile.email)}</p>
            <p className="text-xs text-muted-foreground">{displayLogin(profile.email)}</p>
          </div>
          <SignOutButton />
        </div>
      </div>
      <nav aria-label="Mobile" className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
        {links.map((link) => (
          <NavLink key={link.href} href={link.href} pathname={pathname} label={link.label} />
        ))}
      </nav>
      <GradientBar />
    </header>
  )
}

function NavLink({
  href,
  pathname,
  label,
}: {
  href: string
  pathname: string
  label: string
}) {
  const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium transition-colors duration-200",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      )}
    >
      {label}
    </Link>
  )
}
