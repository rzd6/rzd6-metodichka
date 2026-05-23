"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/contexts/theme-context"
import { getThemeColor } from "@/lib/theme-utils"
import { Crown, Shield, UsersRound, Train, Wrench, Trash2, RefreshCw, Bug, Terminal } from "lucide-react"
import Image from "next/image"
import { getAvatarFilterFromColor } from "@/lib/color-utils"
import type { UserRole } from "@/data/users"
import { BugReportButton } from "@/components/bug-report-button"

interface BugReport {
  id: string
  sender_nickname: string
  sender_role: string
  sender_secondary_role?: string | null
  sender_position: string
  sender_avatar?: string | null
  from_section: string
  message: string
  created_at: string
}

const ROLE_AVATARS: Record<string, string> = {
  Руководство: "/avatars/management.png",
  Заместитель: "/avatars/senior-staff.png",
  "Старший Состав": "/avatars/senior-staff.png",
  ЦдУД: "/avatars/cdud.png",
  ПТО: "/avatars/pto.png",
  "Тех. Администратор": "/avatars/management.png",
}

function RoleBadgeIcon({ role, color }: { role: string; color: string }) {
  const cls = "w-3 h-3"
  switch (role) {
    case "Руководство":
      return <Crown className={cls} style={{ color }} />
    case "Заместитель":
      return <Shield className={cls} style={{ color }} />
    case "Старший Состав":
      return <UsersRound className={cls} style={{ color }} />
    case "ЦдУД":
      return <Train className={cls} style={{ color }} />
    case "ПТО":
      return <Wrench className={cls} style={{ color }} />
    case "Тех. Администратор":
      return <Terminal className={cls} style={{ color }} />
    default:
      return null
  }
}

function formatDate(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function BugReportSection() {
  const { theme } = useTheme()
  const [reports, setReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const tieColor = getThemeColor(theme.colorTheme)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/bug-reports")
      const json = await res.json()
      setReports(json.data || [])
    } catch {
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/bug-reports?id=${id}`, { method: "DELETE" })
      setReports((prev) => prev.filter((r) => r.id !== id))
    } catch {
      // silent
    } finally {
      setDeletingId(null)
    }
  }

  const isDark = theme.mode === "dark"
  const textPrimary = isDark ? "text-white" : "text-gray-900"
  const textMuted = isDark ? "text-white/50" : "text-gray-500"
  const dividerColor = isDark ? "border-white/10" : "border-gray-100"

  return (
    <div className="space-y-6 opacity-95">
      {/* Section header — same style as lectures/training */}
      <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: tieColor + "40" }}>
        <div
          className="p-3 rounded-xl"
          style={{ background: `linear-gradient(135deg, ${tieColor}20, ${tieColor}10)` }}
        >
          <Bug className="w-6 h-6" style={{ color: tieColor }} />
        </div>
        <div className="flex-1">
          <h2 className="text-3xl font-bold" style={{ color: tieColor }}>
            Баг-репорт
          </h2>
          <p className={`text-sm ${textMuted}`}>Сообщения об ошибках от сотрудников</p>
        </div>
        <div className="flex items-center gap-2">
          <BugReportButton sectionLabel="Баг-репорт" />
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReports}
            disabled={loading}
            className={`h-8 px-3 text-xs ${isDark
                ? "border-white/10 bg-transparent text-white hover:bg-white/5"
                : "border-gray-200 bg-transparent text-black hover:bg-gray-50"
              }`}
          >
            <RefreshCw className={`w-3 h-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-32 rounded-2xl animate-pulse ${isDark ? "bg-white/5" : "bg-gray-100"}`}
            />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div
          className={`flex flex-col items-center justify-center py-16 rounded-2xl border-2 ${isDark ? "border-white/10 bg-white/[0.02]" : "border-gray-200 bg-gray-50/50"
            }`}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: tieColor + "20" }}
          >
            <Bug className="w-7 h-7" style={{ color: tieColor }} />
          </div>
          <p className={`text-sm font-semibold ${textPrimary}`}>Нет баг-репортов</p>
          <p className={`text-xs mt-1 ${textMuted}`}>Сообщения появятся здесь после отправки</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const avatar = report.sender_avatar || ROLE_AVATARS[report.sender_role] || "/avatars/cdud.png"
            const isCustomAvatar = !!report.sender_avatar
            return (
              <Card
                key={report.id}
                className={`border-2 rounded-xl overflow-hidden shadow-none ${isDark ? "bg-[#0f1419]/50 border-white/10" : "bg-white border-gray-200"
                  }`}
              >
                <CardContent className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className="w-11 h-11 rounded-full border-2 flex-shrink-0 overflow-hidden flex items-center justify-center"
                      style={{ borderColor: tieColor }}
                    >
                      <Image
                        src={avatar || "/placeholder.svg"}
                        alt={report.sender_role}
                        width={44}
                        height={44}
                        className="w-full h-full object-cover object-center scale-110"
                        style={isCustomAvatar ? undefined : { filter: getAvatarFilterFromColor(theme.colorTheme) }}
                      />
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      {/* Top row: nickname + role badge + section tag + delete */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className={`text-sm font-bold leading-tight ${textPrimary}`}>
                            {report.sender_nickname}
                          </span>
                          {/* Bordered role badge — same style as admin section */}
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold"
                            style={{ borderColor: tieColor + "50", color: tieColor, backgroundColor: tieColor + "12" }}
                          >
                            <RoleBadgeIcon role={report.sender_role} color={tieColor} />
                            {report.sender_role}
                          </span>
                          {report.sender_secondary_role === "Тех. Администратор" && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold flex-shrink-0"
                              style={{ borderColor: tieColor + "50", color: tieColor, backgroundColor: tieColor + "12" }}
                              title="Дополнительная роль: Тех. Администратор"
                            >
                              <Terminal className="w-3 h-3" />
                              Тех. Адм.
                            </span>
                          )}
                          {report.sender_secondary_role === "РЖД" && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold flex-shrink-0"
                              style={{ borderColor: tieColor + "50", color: tieColor, backgroundColor: tieColor + "12" }}
                              title="Дополнительная роль: РЖД"
                            >
                              <Crown className="w-3 h-3" />
                              РЖД
                            </span>
                          )}
                          <span className={`text-xs ${textMuted} hidden sm:inline truncate`}>{report.sender_position}</span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
                            style={{ backgroundColor: tieColor + "18", color: tieColor }}
                          >
                            {report.from_section}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`w-6 h-6 flex-shrink-0 ${isDark
                                ? "text-white/30 hover:text-red-400 hover:bg-red-400/10"
                                : "text-gray-300 hover:text-red-500 hover:bg-red-50"
                              }`}
                            onClick={() => handleDelete(report.id)}
                            disabled={deletingId === report.id}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Divider */}
                      <div
                        className="w-full h-px my-2"
                        style={{ background: `linear-gradient(to right, ${tieColor}40, transparent)` }}
                      />

                      {/* Message + Date */}
                      <div className="flex items-end justify-between gap-2">
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${textPrimary}`}>
                          {report.message}
                        </p>
                        <p className={`text-[11px] flex-shrink-0 ${textMuted}`}>{formatDate(report.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
