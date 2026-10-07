import { BrandLogo } from "@/components/brand/logo"
import { GradientBar } from "@/components/brand/gradient-bar"
import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "Sign in",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const params = await searchParams
  const nextPath = params.next?.startsWith("/") ? params.next : "/"

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at top, rgb(149 51 178 / 18%), transparent 60%)",
        }}
      />
      <Card className="relative w-full max-w-md overflow-hidden bg-card/90">
        <GradientBar />
        <CardHeader className="items-center pt-8 text-center">
          <BrandLogo size={72} />
          <CardTitle className="mt-4 text-2xl">Mana Onboarding</CardTitle>
          <CardDescription className="max-w-sm text-sm leading-6">
            Sign in with Google. Interns only see the modules a manager sends them.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <LoginForm nextPath={nextPath} initialError={params.error ?? null} />
        </CardContent>
      </Card>
    </div>
  )
}
