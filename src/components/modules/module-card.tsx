import Link from "next/link"
import { ArrowRight, Link2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusToggle } from "@/components/modules/status-toggle"
import type { AssignmentStatus, Module, ModuleLink } from "@/lib/types"

export type AssignedModule = Module & {
  assignmentId: string
  status: AssignmentStatus
  links: ModuleLink[]
}

export function ModuleCard({ module }: { module: AssignedModule }) {
  return (
    <Card className="h-full bg-card/80">
      <CardHeader>
        <CardTitle className="text-lg">{module.title}</CardTitle>
        <CardDescription className="text-sm leading-6">
          {module.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link2 className="size-3.5" />
          {module.links.length} {module.links.length === 1 ? "content item" : "content items"}
        </p>
        <StatusToggle assignmentId={module.assignmentId} status={module.status} />
        <Link
          href={`/onboarding/${module.id}`}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          Open contents
          <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
