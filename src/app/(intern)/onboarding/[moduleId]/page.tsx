import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { StatusToggle } from "@/components/modules/status-toggle"
import { requireProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { sortModuleLinks, type Module, type ModuleLink } from "@/lib/types"

export const metadata = {
  title: "Module",
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>
}) {
  const { moduleId } = await params
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data } = await supabase
    .from("assignments")
    .select("id, status, module:modules(*, links:module_links(*))")
    .eq("intern_id", profile.id)
    .eq("module_id", moduleId)
    .maybeSingle()

  const module = (
    Array.isArray(data?.module) ? data?.module[0] : data?.module
  ) as (Module & { links?: ModuleLink[] | null }) | null
  if (!data || !module) notFound()

  const links = sortModuleLinks(module.links)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/onboarding"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to modules
      </Link>

      <article className="rounded-2xl bg-card px-5 py-6 ring-1 ring-foreground/10 sm:px-8 sm:py-8">
        <h1 className="text-3xl font-semibold tracking-tight">{module.title}</h1>
        {module.description ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {module.description}
          </p>
        ) : null}

        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Contents</h2>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contents in this module yet.</p>
          ) : (
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-start justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm transition-colors duration-200 hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{link.title}</span>
                      {link.description ? (
                        <span className="mt-1 block text-muted-foreground leading-6">
                          {link.description}
                        </span>
                      ) : null}
                    </span>
                    <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-10 space-y-3 border-t border-border pt-6">
          <h2 className="text-sm font-medium text-muted-foreground">Your progress</h2>
          <StatusToggle assignmentId={data.id} status={data.status} />
        </div>
      </article>
    </div>
  )
}
