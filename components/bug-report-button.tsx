"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useTheme } from "@/contexts/theme-context"
import { getThemeColor } from "@/lib/theme-utils"

interface BugReportButtonProps {
  sectionLabel: string
}

const SECTION_LABELS: Record<string, string> = {
  contents: "Содержание",
  information: "Информация",
  lectures: "Лекции",
  training: "Тренировки",
  events: "Мероприятия",
  exams: "Экзамены",
  interviews: "Собеседования",
  "retro-train": "Ретропоезд",
  duty: "Дежурство",
  orders: "Приказы",
  "reports-section": "Доклады в рацию",
  "gov-wave": "Гос. волна",
  "report-generation": "Генерация отчётов",
  "report-compiler": "Составитель докладов",
  "rzd-website": "Новости РЖД",
  admin: "Управление",
  "bug-report": "Баг-репорт",
}

export function BugReportButton({ sectionLabel }: BugReportButtonProps) {
  const { theme } = useTheme()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const tieColor = getThemeColor(theme.colorTheme)

  const getCurrentUser = () => {
    if (typeof window === "undefined") return null
    try {
      const stored = localStorage.getItem("currentUser")
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  const handleSend = async () => {
    if (!message.trim()) return
    setSending(true)

    const user = getCurrentUser()
    if (!user) {
      setSending(false)
      return
    }

    try {
      await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_nickname: user.nickname,
          sender_role: user.role,
          sender_secondary_role: user.secondaryRole ?? null,
          sender_position: user.position,
          sender_avatar: user.customAvatar ?? null,
          from_section: sectionLabel,
          message: message.trim(),
        }),
      })
      setSent(true)
      setMessage("")
      setTimeout(() => {
        setSent(false)
        setOpen(false)
      }, 1500)
    } catch {
      // silent fail
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-0.5">
        <Button
          onClick={() => setOpen(true)}
          className="h-8 px-3 text-xs font-medium text-white shadow-sm"
          style={{ backgroundColor: tieColor, border: "none" }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mr-1.5 flex-shrink-0"
          >
            <path
              d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 15v-5m0-4h.01"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Баг-репорт
        </Button>
        <span
          className="text-[11px] leading-none font-medium tracking-wide px-1.5 py-0.5 rounded"
          style={{
            color: tieColor,
            backgroundColor: tieColor + "18",
            border: `1px solid ${tieColor}35`,
          }}
        >
          by Egoriy_Bobryshev
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={`max-w-md ${theme.mode === "dark" ? "bg-[#111] border-white/10 text-white" : "bg-white border-gray-200 text-black"
            }`}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full"
                style={{ backgroundColor: tieColor }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 15v-5m0-4h.01"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Баг-репорт
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div
              className={`text-xs px-3 py-2 rounded-lg ${theme.mode === "dark" ? "bg-white/5 text-white/50" : "bg-gray-100 text-gray-500"
                }`}
            >
              Раздел: <span className="font-medium" style={{ color: tieColor }}>{sectionLabel}</span>
            </div>

            <Textarea
              placeholder="Опишите проблему или баг..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className={`resize-none text-sm ${theme.mode === "dark"
                ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/20"
                : "bg-gray-50 border-gray-200 text-black placeholder:text-gray-400 focus:border-gray-300"
                }`}
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setOpen(false); setMessage("") }}
                className={`text-xs ${theme.mode === "dark"
                  ? "border-white/10 bg-transparent text-white hover:bg-white/5"
                  : "border-gray-200 bg-transparent text-black hover:bg-gray-50"
                  }`}
              >
                Отмена
              </Button>
              <Button
                size="sm"
                disabled={!message.trim() || sending || sent}
                onClick={handleSend}
                className="text-xs text-white"
                style={{ backgroundColor: tieColor }}
              >
                {sent ? "Отправлено" : sending ? "Отправка..." : "Отправить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
