import { ModulesManager } from "@/components/admin/modules-manager"
import { createClient } from "@/lib/supabase/server"
import { sortModuleLinks, type Module, type ModuleLink } from "@/lib/types"

export const metadata = {
  title: "Modules",
}

export default async function AdminModulesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("modules")
    .select("*, links:module_links(*)")
    .order("sort_order")
    .order("title")

  const modules = (data ?? []).map((module) => ({
    ...module,
    links: sortModuleLinks(module.links as ModuleLink[] | null),
  })) satisfies (Module & { links: ModuleLink[] })[]

  return <ModulesManager modules={modules} />
}
