import type { Enums, Tables } from "@/lib/database.types"

export type Profile = Tables<"profiles">
export type Module = Tables<"modules">
export type ModuleLink = Tables<"module_links">
export type Assignment = Tables<"assignments">
export type InternManager = Tables<"intern_managers">
export type Schedule = Tables<"schedules">
export type TimeLog = Tables<"time_logs">
export type UserRole = Enums<"user_role">
export type AssignmentStatus = Enums<"assignment_status">
export type ScheduleStatus = Enums<"schedule_status">

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  not_started: "Assigned",
  in_progress: "Started",
  completed: "Finished",
}

export const STATUS_OPTIONS: { value: AssignmentStatus; label: string }[] = [
  { value: "not_started", label: "Assigned" },
  { value: "in_progress", label: "Started" },
  { value: "completed", label: "Finished" },
]

export type ModuleWithLinks = Module & { links: ModuleLink[] }

export type ManagerLink = Pick<InternManager, "intern_id" | "manager_id">

export function isStaff(role: UserRole) {
  return role === "admin" || role === "master"
}

export function isMaster(role: UserRole) {
  return role === "master"
}

export function roleLabel(role: UserRole) {
  if (role === "master") return "Master"
  if (role === "admin") return "Manager"
  return "Intern"
}

export function sortModuleLinks(links: ModuleLink[] | null | undefined) {
  return [...(links ?? [])].sort((a, b) => a.sort_order - b.sort_order)
}

export function internName(intern: Profile) {
  return intern.full_name ?? intern.email.replace(/@mana\.internal$/i, "")
}

export function managerIdsForIntern(links: ManagerLink[], internId: string) {
  return links
    .filter((link) => link.intern_id === internId)
    .map((link) => link.manager_id)
}

export function internManagerProfiles(
  managers: Profile[],
  links: ManagerLink[],
  internId: string
) {
  const ids = new Set(managerIdsForIntern(links, internId))
  return managers.filter((manager) => ids.has(manager.id))
}

export function managersLabel(managers: Profile[]) {
  if (managers.length === 0) return "No manager"
  return managers.map(internName).join(", ")
}

export function isManagedBy(
  links: ManagerLink[],
  internId: string,
  managerId: string
) {
  return managerIdsForIntern(links, internId).includes(managerId)
}
