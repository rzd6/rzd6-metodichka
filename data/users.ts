import {
  type UserRole,
  type UserGender,
  normalizeStoredRole,
  sortUsersByRole,
  DEFAULT_REPORT_TAGS,
} from "./roles"

export type { UserRole, UserGender } from "./roles"
export { sortUsersByRole, ALL_ROLES, ASSIGNABLE_ROLES } from "./roles"

import {
  canAccessConfiguredSection,
  canAccessEducationalBlock,
  getDefaultSectionPermissions,
} from "./access-permissions"

export interface User {
  id: string
  nickname: string
  password: string
  role: UserRole
  createdAt: string
  vkId?: string
  customAvatar?: string
  secondaryRole?: "Тех. Администратор" | "РЖД"
  reportTag?: string
  gender?: UserGender
}

let cachedUsers: User[] | null = null
let lastFetchTime = 0
const CACHE_DURATION = 5000

let cachedPermissions = getDefaultSectionPermissions()

export function setCachedSectionPermissions(perms: typeof cachedPermissions) {
  cachedPermissions = perms
}

function rowToUser(row: Record<string, unknown>): User {
  const role = normalizeStoredRole(String(row.position ?? row.role ?? "ЦдУД"))
  return {
    id: String(row.id),
    nickname: String(row.username),
    password: String(row.password),
    role,
    createdAt: String(row.created_at),
    vkId: row.vk_id ? String(row.vk_id) : undefined,
    customAvatar: row.custom_avatar ? String(row.custom_avatar) : undefined,
    secondaryRole:
      row.secondary_role === "Тех. Администратор" || row.secondary_role === "РЖД"
        ? (row.secondary_role as "Тех. Администратор" | "РЖД")
        : undefined,
    reportTag: row.report_tag ? String(row.report_tag) : undefined,
    gender: row.gender === "female" ? "female" : "male",
  }
}

async function apiFetch(path: string, options?: RequestInit) {
  const base = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  })
  return res.json()
}

async function initializeUsers(forceRefresh = false): Promise<User[]> {
  const now = Date.now()
  if (!forceRefresh && cachedUsers && now - lastFetchTime < CACHE_DURATION) {
    return cachedUsers
  }

  try {
    const { data, error } = await apiFetch("/api/users")
    if (error || !Array.isArray(data)) return []
    const users = data.map(rowToUser)
    cachedUsers = users
    lastFetchTime = Date.now()
    return users
  } catch {
    return []
  }
}

export function invalidateUserCache() {
  cachedUsers = null
  lastFetchTime = 0
}

export async function addUser(
  nickname: string,
  password: string,
  role: UserRole,
  vkId?: string
): Promise<User | null> {
  try {
    const { data, error } = await apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify({
        username: nickname,
        password,
        full_name: `[${role}] ${nickname}`,
        position: role,
        rank: getRankFromRole(role),
        avatar: getAvatarFromRole(role),
        ...(vkId ? { vk_id: vkId } : {}),
      }),
    })

    if (error || !data) return null

    invalidateUserCache()

    if (role === "Руководство" && nickname !== "Admin") {
      await apiFetch("/api/users", {
        method: "DELETE",
        body: JSON.stringify({ username: "Admin" }),
      })
      invalidateUserCache()
    }

    return rowToUser(data)
  } catch {
    return null
  }
}

export async function updateUser(
  id: string,
  updates: Partial<Omit<User, "id" | "createdAt">>
): Promise<User | null> {
  try {
    const body: Record<string, unknown> = { id }
    if (updates.nickname) body.username = updates.nickname
    if (updates.password) body.password = updates.password
    if (updates.role) {
      body.position = updates.role
      body.rank = getRankFromRole(updates.role)
      body.avatar = getAvatarFromRole(updates.role)
      body.full_name = `[${updates.role}] ${updates.nickname ?? ""}`
    }
    if ("vkId" in updates) {
      body.vk_id = updates.vkId || null
    }
    if ("customAvatar" in updates) {
      body.custom_avatar = updates.customAvatar || null
    }
    if ("secondaryRole" in updates) {
      body.secondary_role = updates.secondaryRole || null
    }
    if ("reportTag" in updates) {
      body.report_tag = updates.reportTag || null
    }
    if ("gender" in updates) {
      body.gender = updates.gender || "male"
    }

    const { data, error } = await apiFetch("/api/users", {
      method: "PATCH",
      body: JSON.stringify(body),
    })

    if (error || !data) return null
    invalidateUserCache()
    return rowToUser(data)
  } catch {
    return null
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    await apiFetch("/api/users", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    })
    invalidateUserCache()
    return true
  } catch {
    return false
  }
}

export async function findUserByNickname(nickname: string): Promise<User | undefined> {
  try {
    const { data } = await apiFetch(`/api/users?username=${encodeURIComponent(nickname)}`)
    return data ? rowToUser(data) : undefined
  } catch {
    return undefined
  }
}

export async function findUserByVkId(vkId: string): Promise<User | null> {
  try {
    const { data } = await apiFetch(`/api/users?vk_id=${encodeURIComponent(vkId)}`)
    return data ? rowToUser(data) : null
  } catch {
    return null
  }
}

export async function authenticateUser(nickname: string, password: string): Promise<User | null> {
  try {
    const { data } = await apiFetch(
      `/api/users?username=${encodeURIComponent(nickname)}&password=${encodeURIComponent(password)}`
    )
    return data ? rowToUser(data) : null
  } catch {
    return null
  }
}

export async function getAllUsers(forceRefresh = false): Promise<User[]> {
  return await initializeUsers(forceRefresh)
}

function getRankFromRole(role: UserRole): number {
  const rankMap: Record<UserRole, number> = {
    Руководство: 9,
    Заместитель: 8,
    "Старший Состав": 7,
    ЦдУД: 5,
    ПТО: 3,
    "Тех. Администратор": 10,
  }
  return rankMap[role] || 1
}

function getAvatarFromRole(role: UserRole): string {
  const avatarMap: Record<UserRole, string> = {
    Руководство: "/avatars/management.png",
    Заместитель: "/avatars/management.png",
    "Старший Состав": "/avatars/senior-staff.png",
    ЦдУД: "/avatars/cdud.png",
    ПТО: "/avatars/pto.png",
    "Тех. Администратор": "/avatars/management.png",
  }
  return avatarMap[role] || "/avatars/cdud.png"
}

export function isTechAdmin(role: UserRole, secondaryRole?: string): boolean {
  return role === "Тех. Администратор" || secondaryRole === "Тех. Администратор"
}

export function getEffectiveReportTag(user: Pick<User, "role" | "reportTag">): string {
  const tag = user.reportTag?.trim()
  if (tag) {
    if (tag.startsWith("[") && tag.endsWith("]")) return tag
    return `[${tag}]`
  }
  return DEFAULT_REPORT_TAGS[user.role] || "[ТЭГ]"
}

export function canManageAllRoles(role: UserRole, secondaryRole?: string): boolean {
  return role === "Руководство" || isTechAdmin(role, secondaryRole)
}

export function canManageCdUDAndPTO(role: UserRole, secondaryRole?: string): boolean {
  return role === "Руководство" || role === "Заместитель" || isTechAdmin(role, secondaryRole)
}

export function canChangeBetweenCdUDAndPTO(role: UserRole, secondaryRole?: string): boolean {
  return (
    role === "Руководство" ||
    role === "Заместитель" ||
    role === "Старший Состав" ||
    isTechAdmin(role, secondaryRole)
  )
}

export function canSeePasswords(role: UserRole, secondaryRole?: string): boolean {
  return role === "Руководство" || role === "Заместитель" || isTechAdmin(role, secondaryRole)
}

function isRZD(secondaryRole?: string): boolean {
  return secondaryRole === "РЖД"
}

export function canAccessManagement(role: UserRole, secondaryRole?: string): boolean {
  return canAccessConfiguredSection("admin", cachedPermissions, role, secondaryRole)
}

export function canAccessInterviews(_role: UserRole, _secondaryRole?: string): boolean {
  return true
}

export function canAccessMaintenance(role: UserRole, secondaryRole?: string): boolean {
  if (isTechAdmin(role, secondaryRole)) return true
  return role === "ЦдУД" || role === "ПТО"
}

export function canAccessReportGeneration(role: UserRole, secondaryRole?: string): boolean {
  return canAccessConfiguredSection("report-generation", cachedPermissions, role, secondaryRole)
}

export function canSeeLeadershipReport(role: UserRole, secondaryRole?: string): boolean {
  return role === "Руководство" || isTechAdmin(role, secondaryRole)
}

export function canSeeReprimandReport(_role: UserRole, _secondaryRole?: string): boolean {
  return true
}

export function canSeeCDUDReport(role: UserRole, secondaryRole?: string): boolean {
  return role === "ЦдУД" || isTechAdmin(role, secondaryRole)
}

export function canSeePTOReport(role: UserRole, secondaryRole?: string): boolean {
  return role === "ПТО" || isTechAdmin(role, secondaryRole)
}

export function canSeeSeniorStaffReport(role: UserRole, secondaryRole?: string): boolean {
  return role === "Старший Состав" || isTechAdmin(role, secondaryRole)
}

export function canAccessReportCompiler(role: UserRole, secondaryRole?: string): boolean {
  return canAccessConfiguredSection("report-compiler", cachedPermissions, role, secondaryRole)
}

export function canAccessEducationalContent(role: UserRole, secondaryRole?: string): boolean {
  return canAccessEducationalBlock(cachedPermissions, role, secondaryRole)
}

export function canAccessOrders(role: UserRole, secondaryRole?: string): boolean {
  return canAccessConfiguredSection("orders", cachedPermissions, role, secondaryRole)
}

export function canAccessGovWave(role: UserRole, secondaryRole?: string): boolean {
  return canAccessConfiguredSection("gov-wave", cachedPermissions, role, secondaryRole)
}

export function canAccessGoogleSheets(role: UserRole, secondaryRole?: string): boolean {
  return role === "Руководство" || role === "Заместитель" || role === "Старший Состав" || isTechAdmin(role, secondaryRole)
}

export function canAccessBugReport(role: UserRole, secondaryRole?: string): boolean {
  return canAccessConfiguredSection("bug-report", cachedPermissions, role, secondaryRole)
}

export function canAccessAnnouncements(role: UserRole, secondaryRole?: string): boolean {
  return canAccessConfiguredSection("rzd-website", cachedPermissions, role, secondaryRole)
}

export function canPostAsFaction(role: UserRole, secondaryRole?: string): boolean {
  return role === "Руководство" || isTechAdmin(role, secondaryRole)
}

export function canManageTrainDB(role: UserRole, secondaryRole?: string): boolean {
  return role === "Руководство" || isTechAdmin(role, secondaryRole)
}

export function canClaimShift(_role: UserRole, _secondaryRole?: string): boolean {
  return true
}

export function canDeleteOwnShift(_role: UserRole, _secondaryRole?: string): boolean {
  return true
}

export function canDeleteAnyShift(role: UserRole, secondaryRole?: string): boolean {
  return role === "Руководство" || role === "Заместитель" || isTechAdmin(role, secondaryRole)
}

/** @deprecated используйте sortUsersByRole */
export const sortUsersByPosition = sortUsersByRole
