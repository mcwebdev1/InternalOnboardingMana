"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export type ModuleLinkInput = {
  title: string
  url: string
  description?: string
}

export async function upsertModule(input: {
  id?: string
  title: string
  description: string
  links: ModuleLinkInput[]
}) {
  const admin = await requireAdmin()
  const supabase = await createClient()

  const title = input.title.trim()
  const description = input.description.trim()
  const links = input.links
    .map((link) => ({
      title: link.title.trim(),
      url: link.url.trim(),
      description: link.description?.trim() ?? "",
    }))
    .filter((link) => link.title || link.url || link.description)

  if (!title) return { error: "Title is required." }
  if (links.some((link) => !link.title || !link.url)) {
    return { error: "Each content item needs a title and a URL." }
  }
  if (links.some((link) => !/^https?:\/\//i.test(link.url))) {
    return { error: "URLs must start with http:// or https://." }
  }

  let moduleId = input.id

  if (moduleId) {
    const { error } = await supabase
      .from("modules")
      .update({ title, description: description || null })
      .eq("id", moduleId)
    if (error) return { error: error.message }

    const { error: deleteError } = await supabase
      .from("module_links")
      .delete()
      .eq("module_id", moduleId)
    if (deleteError) return { error: deleteError.message }
  } else {
    const { data, error } = await supabase
      .from("modules")
      .insert({
        title,
        description: description || null,
        slug: slugify(title),
        created_by: admin.id,
        content: "",
      })
      .select("id")
      .single()
    if (error) return { error: error.message }
    moduleId = data.id
  }

  if (links.length) {
    const { error } = await supabase.from("module_links").insert(
      links.map((link, index) => ({
        module_id: moduleId!,
        title: link.title,
        url: link.url,
        description: link.description || null,
        sort_order: (index + 1) * 10,
      }))
    )
    if (error) return { error: error.message }
  }

  revalidatePath("/admin")
  revalidatePath("/admin/modules")
  revalidatePath("/admin/assign")
  revalidatePath("/onboarding")
  return { success: true }
}

export async function deleteModule(moduleId: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("modules").delete().eq("id", moduleId)
  if (error) return { error: error.message }

  revalidatePath("/admin")
  revalidatePath("/admin/modules")
  revalidatePath("/admin/assign")
  revalidatePath("/onboarding")
  return { success: true }
}
