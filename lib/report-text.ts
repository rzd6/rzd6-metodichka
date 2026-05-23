import type { UserGender, UserRole } from "@/data/roles"
import { DEFAULT_REPORT_TAGS } from "@/data/roles"
import { applyGenderToText } from "@/lib/gender-text"

export function resolveReportTag(
  customTag: string | undefined | null,
  role: UserRole
): string {
  const trimmed = customTag?.trim()
  if (trimmed) {
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed
    return `[${trimmed}]`
  }
  return DEFAULT_REPORT_TAGS[role] || "[ТЭГ]"
}

export function formatReportText(
  text: string,
  options: {
    reportTag?: string | null
    role?: UserRole
    gender?: UserGender
  }
): string {
  const tag =
    options.reportTag ??
    (options.role ? DEFAULT_REPORT_TAGS[options.role] : "[ТЭГ]")

  let result = text.replace(/\[ТЭГ\]/g, tag)

  if (options.gender) {
    result = applyGenderToText(result, options.gender)
  }

  return result
}
