import type { UserRole } from "@/data/roles"

function isTechAdminRole(role: UserRole, secondaryRole?: string): boolean {
  return role === "Тех. Администратор" || secondaryRole === "Тех. Администратор"
}

export interface SectionPermissionDef {
  id: string
  label: string
  description?: string
  /** Роли с доступом (основная роль пользователя) */
  allowedRoles: UserRole[]
  /** Доп. роль «РЖД» даёт доступ */
  allowSecondaryRZD?: boolean
}

/** Разделы, видимость которых настраивает тех. администратор */
export const CONFIGURABLE_SECTIONS: SectionPermissionDef[] = [
  {
    id: "lectures",
    label: "Лекции",
    description: "Блок обучения: лекции, тренировки, мероприятия, экзамены",
    allowedRoles: ["Руководство", "Заместитель", "Старший Состав"],
    allowSecondaryRZD: true,
  },
  {
    id: "training",
    label: "Тренировки",
    allowedRoles: ["Руководство", "Заместитель", "Старший Состав"],
    allowSecondaryRZD: true,
  },
  {
    id: "events",
    label: "Мероприятия",
    allowedRoles: ["Руководство", "Заместитель", "Старший Состав"],
    allowSecondaryRZD: true,
  },
  {
    id: "exams",
    label: "Экзамены",
    allowedRoles: ["Руководство", "Заместитель", "Старший Состав"],
    allowSecondaryRZD: true,
  },
  {
    id: "orders",
    label: "Приказы",
    allowedRoles: ["Руководство", "Заместитель", "Старший Состав"],
    allowSecondaryRZD: true,
  },
  {
    id: "gov-wave",
    label: "Гос. волна",
    allowedRoles: ["Руководство", "Заместитель"],
    allowSecondaryRZD: true,
  },
  {
    id: "report-generation",
    label: "Генерация отчётов",
    allowedRoles: ["ПТО", "ЦдУД", "Старший Состав", "Заместитель", "Руководство"],
  },
  {
    id: "report-compiler",
    label: "Составитель докладов",
    allowedRoles: ["Руководство", "Заместитель", "Старший Состав", "ЦдУД"],
    allowSecondaryRZD: true,
  },
  {
    id: "rzd-website",
    label: "Официальные уведомления",
    allowedRoles: ["Руководство", "Заместитель", "Старший Состав"],
    allowSecondaryRZD: true,
  },
  {
    id: "admin",
    label: "Управление (аккаунты)",
    allowedRoles: ["Руководство", "Заместитель", "Старший Состав"],
    allowSecondaryRZD: true,
  },
  {
    id: "bug-report",
    label: "Баг-репорт",
    allowedRoles: ["Руководство"],
  },
]

export type SectionPermissionsMap = Record<string, SectionPermissionDef>

export function getDefaultSectionPermissions(): SectionPermissionsMap {
  const map: SectionPermissionsMap = {}
  for (const section of CONFIGURABLE_SECTIONS) {
    map[section.id] = { ...section, allowedRoles: [...section.allowedRoles] }
  }
  return map
}

export function canAccessConfiguredSection(
  sectionId: string,
  permissions: SectionPermissionsMap,
  role: UserRole,
  secondaryRole?: string
): boolean {
  if (isTechAdminRole(role, secondaryRole)) return true

  const def = permissions[sectionId]
  if (!def) return true

  if (def.allowSecondaryRZD && secondaryRole === "РЖД") return true

  return def.allowedRoles.includes(role)
}

/** Образовательный блок целиком */
export function canAccessEducationalBlock(
  permissions: SectionPermissionsMap,
  role: UserRole,
  secondaryRole?: string
): boolean {
  return (
    canAccessConfiguredSection("lectures", permissions, role, secondaryRole) ||
    canAccessConfiguredSection("training", permissions, role, secondaryRole) ||
    canAccessConfiguredSection("events", permissions, role, secondaryRole) ||
    canAccessConfiguredSection("exams", permissions, role, secondaryRole)
  )
}
