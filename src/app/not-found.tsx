import Link from "next/link"
import { BrandLogo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <BrandLogo size={56} />
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        This screen is missing, or you do not have this module assigned.
      </p>
      <Button asChild className="h-11 cursor-pointer px-4">
        <Link href="/">Back home</Link>
      </Button>
    </div>
  )
}
