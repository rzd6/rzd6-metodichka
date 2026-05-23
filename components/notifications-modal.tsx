"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Bell, Users, UserRound, X } from "lucide-react"
import Image from "next/image"
import { getArticles, type Article } from "@/lib/supabase-rzd"
import { useTheme } from "@/contexts/theme-context"
import { getThemeColor } from "@/lib/theme-utils"
import { getAvatarFilterFromColor } from "@/lib/color-utils"
import type { UserRole } from "@/data/users"

interface NotificationsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userRole: UserRole
  secondaryRole?: string
}

const ROLE_AVATARS: Record<string, string> = {
  Руководство: "/avatars/management.png",
  Заместитель: "/avatars/senior-staff.png",
  "Старший Состав": "/avatars/senior-staff.png",
  ЦдУД: "/avatars/cdud.png",
  ПТО: "/avatars/pto.png",
}

export function NotificationsModal({ open, onOpenChange, userRole, secondaryRole }: NotificationsModalProps) {
  const { theme } = useTheme()
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authorAvatars, setAuthorAvatars] = useState<Record<string, string | null>>({})

  const getTieColor = () => getThemeColor(theme.colorTheme)

  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    setError(null)
    getArticles()
      .then(async (all) => {
        const filtered = all.filter((a) => {
          if (!a.is_published || !Array.isArray(a.allowed_roles)) return false
          // Тех. Администратор (primary or secondary) sees all articles
          if (userRole === "Тех. Администратор" || secondaryRole === "Тех. Администратор") return true
          return a.allowed_roles.includes(userRole) || (secondaryRole ? a.allowed_roles.includes(secondaryRole) : false)
        })
        setArticles(filtered)

        // Fetch custom avatars for authors from users API
        const authorIds = [...new Set(filtered.map((a) => a.author_id).filter(Boolean))]
        if (authorIds.length > 0) {
          try {
            const res = await fetch("/api/users")
            const json = await res.json()
            const avatarMap: Record<string, string | null> = {}
            for (const u of json.data || []) {
              if (u.custom_avatar) {
                avatarMap[u.id] = u.custom_avatar
              }
            }
            setAuthorAvatars(avatarMap)
          } catch {
            // silent
          }
        }
      })
      .catch((err: any) => {
        setError(err?.message || "Не удалось загрузить уведомления")
        setArticles([])
      })
      .finally(() => setIsLoading(false))
  }, [open, userRole])

  const getAuthorBlock = (article: Article) => {
    const isFaction = article.author_name === "Группа РЖД"
    const customAv = article.author_id ? authorAvatars[article.author_id] : null

    // Determine role-based avatar fallback (using author_name as nickname hint)
    const roleAvatar = isFaction ? "/avatars/management.png" : "/avatars/senior-staff.png"
    const avatarSrc = customAv || roleAvatar

    return (
      <div className="flex items-center gap-1.5">
        <div
          className="w-5 h-5 rounded-full overflow-hidden border flex-shrink-0"
          style={{ borderColor: getTieColor() + "60" }}
        >
          <Image
            src={avatarSrc || "/placeholder.svg"}
            alt={article.author_name}
            width={20}
            height={20}
            className="w-full h-full object-cover object-center scale-110"
            style={customAv ? undefined : { filter: getAvatarFilterFromColor(theme.colorTheme) }}
          />
        </div>
        <span className="text-sm font-medium" style={isFaction ? { color: getTieColor() } : {}}>
          {article.author_name}
        </span>
        {isFaction && (
          <Badge
            className="text-[10px] px-1.5 py-0 font-semibold text-white"
            style={{ backgroundColor: getTieColor() }}
          >
            Фракция
          </Badge>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-xl w-full max-h-[80vh] overflow-y-auto rounded-2xl border-2 ${
          theme.mode === "dark" ? "bg-[#0f1419] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
        }`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold" style={{ color: getTieColor() }}>
            <Bell className="w-5 h-5" />
            Уведомления
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          {isLoading && (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`rounded-xl border-2 p-4 animate-pulse ${
                    theme.mode === "dark" ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
                  }`}
                  style={{ borderLeftWidth: "3px", borderLeftColor: getTieColor() + "60", opacity: 1 - (i - 1) * 0.2 }}
                >
                  <div className="h-4 rounded mb-2" style={{ backgroundColor: getTieColor() + "25", width: "60%" }} />
                  <div className="h-3 rounded mb-1.5" style={{ backgroundColor: getTieColor() + "15", width: "90%" }} />
                  <div className="h-3 rounded" style={{ backgroundColor: getTieColor() + "15", width: "70%" }} />
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div
              className="flex items-start gap-2 px-4 py-3 rounded-xl border text-sm"
              style={{ backgroundColor: "#ef44441a", borderColor: "#ef444440" }}
            >
              <X className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
              <span className="text-red-500">{error}</span>
            </div>
          )}

          {!isLoading && !error && articles.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12">
              <div
                className="p-4 rounded-full"
                style={{ backgroundColor: getTieColor() + "15" }}
              >
                <Bell className="w-8 h-8" style={{ color: getTieColor() + "80" }} />
              </div>
              <p className="text-sm text-muted-foreground">Нет новых уведомлений</p>
            </div>
          )}

          {!isLoading && articles.map((article) => (
            <div
              key={article.id}
              className={`p-4 rounded-xl border-2 ${
                theme.mode === "dark"
                  ? "bg-white/5 border-white/10"
                  : "bg-gray-50 border-gray-200"
              }`}
              style={{ borderLeftWidth: "3px", borderLeftColor: getTieColor() }}
            >
              {article.image_url && article.image_url.length > 0 && (
                <div className={`mb-3 ${article.image_url.length === 1 ? "flex justify-center" : "grid grid-cols-2 gap-2"}`}>
                  {article.image_url.map((url, i) => (
                    <img
                      key={i}
                      src={url || "/placeholder.svg"}
                      alt={`${article.title} — изображение ${i + 1}`}
                      className="rounded-lg w-full max-h-48 object-contain"
                    />
                  ))}
                </div>
              )}

              <h3 className="font-bold text-base mb-2">{article.title}</h3>
              <p
                className={`text-sm leading-relaxed whitespace-pre-wrap mb-3 ${
                  theme.mode === "dark" ? "text-white/70" : "text-gray-600"
                }`}
              >
                {article.content}
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                {getAuthorBlock(article)}
                <span className="text-xs text-muted-foreground">
                  {new Date(article.created_at).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
