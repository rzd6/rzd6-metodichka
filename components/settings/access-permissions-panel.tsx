"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Shield, Save } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"
import { getThemeColor } from "@/lib/theme-utils"
import {
  CONFIGURABLE_SECTIONS,
  getDefaultSectionPermissions,
  type SectionPermissionsMap,
} from "@/data/access-permissions"
import { ALL_ROLES, type UserRole } from "@/data/roles"

export function AccessPermissionsPanel() {
  const { theme } = useTheme()
  const [permissions, setPermissions] = useState<SectionPermissionsMap>(getDefaultSectionPermissions())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const getTieColor = () => getThemeColor(theme.colorTheme)

  useEffect(() => {
    fetch("/api/access-permissions")
      .then((r) => r.json())
      .then((d) => {
        if (d.permissions) {
          setPermissions({ ...getDefaultSectionPermissions(), ...d.permissions })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleRole = (sectionId: string, role: UserRole, checked: boolean) => {
    setPermissions((prev) => {
      const section = prev[sectionId] ?? CONFIGURABLE_SECTIONS.find((s) => s.id === sectionId)!
      const roles = new Set(section.allowedRoles)
      if (checked) roles.add(role)
      else roles.delete(role)
      return {
        ...prev,
        [sectionId]: { ...section, allowedRoles: Array.from(roles) as UserRole[] },
      }
    })
    setSaved(false)
  }

  const toggleRzd = (sectionId: string, checked: boolean) => {
    setPermissions((prev) => {
      const section = prev[sectionId]!
      return {
        ...prev,
        [sectionId]: { ...section, allowSecondaryRZD: checked },
      }
    })
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/access-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      })
      const data = await res.json()
      if (data.success) {
        setSaved(true)
        window.dispatchEvent(new Event("accessPermissionsUpdated"))
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className={`text-sm ${theme.mode === "dark" ? "text-white/50" : "text-gray-500"}`}>Загрузка прав...</p>
  }

  return (
    <div className="space-y-4">
      <Label className={`text-base flex items-center gap-2 ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
        <Shield className="w-4 h-4" style={{ color: getTieColor() }} />
        Управление доступами к разделам
      </Label>
      <p className={`text-xs ${theme.mode === "dark" ? "text-white/50" : "text-gray-500"}`}>
        Отметьте, какие роли видят каждый раздел сайта. Тех. администраторы всегда имеют полный доступ.
      </p>

      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
        {CONFIGURABLE_SECTIONS.map((section) => {
          const perm = permissions[section.id] ?? section
          return (
            <div
              key={section.id}
              className="rounded-lg border p-3 space-y-2"
              style={{ borderColor: getTieColor() + "35", background: getTieColor() + "06" }}
            >
              <p className={`text-sm font-medium ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
                {section.label}
              </p>
              {section.description && (
                <p className={`text-xs ${theme.mode === "dark" ? "text-white/45" : "text-gray-400"}`}>
                  {section.description}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {ALL_ROLES.filter((r) => r !== "Тех. Администратор").map((role) => (
                  <label
                    key={role}
                    className={`flex items-center gap-2 text-xs cursor-pointer ${theme.mode === "dark" ? "text-white/80" : "text-gray-700"}`}
                  >
                    <Checkbox
                      checked={perm.allowedRoles.includes(role)}
                      onCheckedChange={(v) => toggleRole(section.id, role, !!v)}
                    />
                    {role}
                  </label>
                ))}
              </div>
              {section.allowSecondaryRZD !== undefined && (
                <label
                  className={`flex items-center gap-2 text-xs cursor-pointer pt-1 border-t ${theme.mode === "dark" ? "border-white/10 text-white/70" : "border-gray-200 text-gray-600"}`}
                >
                  <Checkbox
                    checked={!!perm.allowSecondaryRZD}
                    onCheckedChange={(v) => toggleRzd(section.id, !!v)}
                  />
                  Доп. роль «РЖД» тоже видит раздел
                </label>
              )}
            </div>
          )
        })}
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full text-white font-semibold"
        style={{ backgroundColor: getTieColor() }}
      >
        <Save className="w-4 h-4 mr-2" />
        {saving ? "Сохранение..." : saved ? "Сохранено" : "Сохранить доступы"}
      </Button>
    </div>
  )
}
