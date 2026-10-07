"use client"

import { useState, useTransition } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deleteModule, upsertModule } from "@/lib/actions/modules"
import type { Module, ModuleLink } from "@/lib/types"
import {
  ModuleContentsEditor,
  createContentDraft,
  type ContentDraft,
} from "@/components/admin/module-contents-editor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/empty-state"

type ModuleWithLinks = Module & { links: ModuleLink[] }

export function ModulesManager({ modules }: { modules: ModuleWithLinks[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Module library</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Each module is a title, a short description, and the contents
            interns need to open.
          </p>
        </div>
        <ModuleEditor />
      </div>

      {modules.length === 0 ? (
        <EmptyState
          title="No modules yet"
          description="Add the first onboarding module, then send it to the intern accounts that need it."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {modules.map((module) => (
            <li key={module.id} className="space-y-3 px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{module.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {module.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ModuleEditor module={module} />
                  <DeleteModuleButton moduleId={module.id} title={module.title} />
                </div>
              </div>
              {module.links.length ? (
                <ol className="space-y-2 text-sm">
                  {module.links.map((link, index) => (
                    <li key={link.id} className="text-muted-foreground">
                      <span className="text-foreground">
                        {index + 1}. {link.title}:
                      </span>{" "}
                      {link.url}
                      {link.description ? (
                        <span className="mt-0.5 block pl-4">{link.description}</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No contents yet</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function draftsFromModule(module?: ModuleWithLinks): ContentDraft[] {
  if (module?.links.length) {
    return module.links.map((link) =>
      createContentDraft({
        id: link.id,
        title: link.title,
        url: link.url,
        description: link.description ?? "",
      })
    )
  }
  return [createContentDraft({ id: "draft-1" })]
}

function ModuleEditor({ module }: { module?: ModuleWithLinks }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [links, setLinks] = useState<ContentDraft[]>(() => draftsFromModule(module))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setLinks(draftsFromModule(module))
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant={module ? "outline" : "default"}
          className="h-11 cursor-pointer px-4"
        >
          {module ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {module ? "Edit" : "New module"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{module ? "Edit module" : "Create module"}</DialogTitle>
          <DialogDescription>
            Interns only see this after you assign it. Add each academy page or
            file as contents, then drag to set the order.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            startTransition(async () => {
              const result = await upsertModule({
                id: module?.id,
                title: String(form.get("title") ?? ""),
                description: String(form.get("description") ?? ""),
                links,
              })
              if ("error" in result) {
                toast.error(result.error)
                return
              }
              toast.success(module ? "Module updated" : "Module created")
              setOpen(false)
            })
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={module?.title}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={module?.description ?? ""}
              className="min-h-20"
            />
          </div>
          <ModuleContentsEditor items={links} onChange={setLinks} />
          <DialogFooter>
            <Button type="submit" className="h-11 cursor-pointer px-4" disabled={pending}>
              {pending ? "Saving..." : "Save module"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteModuleButton({
  moduleId,
  title,
}: {
  moduleId: string
  title: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="destructive"
      className="h-11 cursor-pointer px-3"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete "${title}"? Assigned progress will be removed.`)) return
        startTransition(async () => {
          const result = await deleteModule(moduleId)
          if ("error" in result) toast.error(result.error)
          else toast.success("Module deleted")
        })
      }}
    >
      <Trash2 className="size-4" />
      <span className="sr-only">Delete {title}</span>
    </Button>
  )
}
