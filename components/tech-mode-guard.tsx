"use client"

import { useTheme } from "@/contexts/theme-context"
import { getThemeColor } from "@/lib/theme-utils"
import { Terminal, AlertTriangle, Wrench, LogIn, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"

interface TechModeGuardProps {
  children: React.ReactNode
  isTechAdmin: boolean
  currentUserNickname?: string
  techMode: boolean
}

export function TechModeGuard({ children, isTechAdmin, currentUserNickname, techMode }: TechModeGuardProps) {
  const { theme } = useTheme()
  const tieColor = getThemeColor(theme.colorTheme)
  const router = useRouter()

  // If tech mode is off, or user is a tech admin — show content as usual
  if (!techMode || isTechAdmin) {
    return <>{children}</>
  }

  const handleSwitchAccount = () => {
    localStorage.removeItem("currentUser")
    router.push("/login")
  }

  // Full-screen maintenance screen for everyone else
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      {/* Animated background grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(${tieColor}20 1px, transparent 1px), linear-gradient(90deg, ${tieColor}20 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Pulsing accent ring */}
      <div
        className="absolute w-96 h-96 rounded-full opacity-10 animate-ping"
        style={{ backgroundColor: tieColor, animationDuration: "3s" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center px-6 max-w-lg">
        {/* Icon block */}
        <div
          className="w-24 h-24 rounded-2xl flex items-center justify-center border-2"
          style={{ borderColor: tieColor + "60", backgroundColor: tieColor + "15" }}
        >
          <div className="relative">
            <Wrench className="w-10 h-10" style={{ color: tieColor }} />
            <div
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: tieColor }}
            >
              <AlertTriangle className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Terminal className="w-4 h-4" style={{ color: tieColor }} />
            <span className="text-xs font-mono tracking-widest uppercase" style={{ color: tieColor }}>
              Технические работы
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Доступ ограничен</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            В данный момент на платформе проводятся технические работы.<br />
            Сервис временно недоступен. Приносим извинения за неудобства.
          </p>
        </div>

        {/* Divider with accent */}
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px" style={{ backgroundColor: tieColor + "30" }} />
          <span className="text-xs font-mono" style={{ color: tieColor + "80" }}>
            503
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: tieColor + "30" }} />
        </div>

        {/* Status */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full border text-xs"
          style={{ borderColor: tieColor + "40", color: tieColor, backgroundColor: tieColor + "10" }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: tieColor }}
          />
          Ожидайте возобновления работы
        </div>

        {/* Switch account button */}
        <button
          onClick={handleSwitchAccount}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80 active:scale-95"
          style={{
            backgroundColor: tieColor + "15",
            border: `1px solid ${tieColor}30`,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <LogIn className="w-3.5 h-3.5" style={{ color: tieColor }} />
          {currentUserNickname
            ? `Войти как другой пользователь (сейчас: ${currentUserNickname})`
            : "Войти как тех. администратор"}
        </button>
      </div>
    </div>
  )
}
