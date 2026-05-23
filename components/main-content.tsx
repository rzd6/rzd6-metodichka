"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { ContentSection } from "@/components/sections/content-section"
import { ThemeProvider, useTheme } from "@/contexts/theme-context"
import { AccessProvider } from "@/contexts/access-context"
import { TechModeGuard } from "@/components/tech-mode-guard"
import { useRouter } from "next/navigation"
import type { UserRole } from "@/data/users"
import { getAllUsers } from "@/data/users"
import { getThemeColor } from "@/lib/theme-utils"

interface LocalUser {
  id: string
  nickname: string
  role: UserRole
  vkAccessToken: string
  secondaryRole?: "Тех. Администратор" | "РЖД"
  customAvatar?: string
  reportTag?: string
  gender?: "male" | "female"
}

function MainContentInner() {
  const [activeSection, setActiveSection] = useState("contents")
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [user, setUser] = useState<LocalUser | null>(null)
  const [customBg, setCustomBg] = useState<string | null>(null)
  const [globalTechMode, setGlobalTechMode] = useState(false)
  const { theme } = useTheme()
  const router = useRouter()

  const DEFAULT_BACKGROUND =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/sapsan-bridge-P2tdAk8LEJIgwJMoqXjcGPvLxnyjps.jpg"

  // Load custom background from localStorage on mount + listen for updates
  useEffect(() => {
    const loadCustomBg = () => {
      const stored = localStorage.getItem("rzd-custom-bg")
      setCustomBg(stored || null)
    }
    loadCustomBg()
    window.addEventListener("customBgUpdated", loadCustomBg)
    return () => window.removeEventListener("customBgUpdated", loadCustomBg)
  }, [])

  // Poll global tech mode from Supabase every 10 seconds
  useEffect(() => {
    const fetchTechMode = async () => {
      try {
        const res = await fetch("/api/tech-mode")
        const data = await res.json()
        setGlobalTechMode(!!data.enabled)
      } catch {
        // Network error — keep current state
      }
    }

    fetchTechMode()
    const interval = setInterval(fetchTechMode, 10000)

    // Also listen for local tech mode toggle events from settings modal
    const handleTechModeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (typeof detail?.enabled === "boolean") {
        setGlobalTechMode(detail.enabled)
      }
    }
    window.addEventListener("techModeChanged", handleTechModeChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener("techModeChanged", handleTechModeChange)
    }
  }, [])

  const getBackgroundImage = () => {
    // Custom uploaded bg takes priority
    if (customBg) return customBg
    const bg = theme.background
    if (!bg || bg.startsWith("/backgrounds/")) return DEFAULT_BACKGROUND
    return bg
  }

  const getTieColor = () => getThemeColor(theme.colorTheme)

  useEffect(() => {
    // Initial auth check — load from localStorage, then verify in DB once
    const authData = localStorage.getItem("currentUser")
    if (!authData) {
      router.push("/login")
      return
    }

    let userData: LocalUser
    try {
      userData = JSON.parse(authData)
    } catch {
      router.push("/login")
      return
    }

    // Show stored data immediately — no waiting for DB
    setUser(userData)

    // Verify + refresh from DB in background (does NOT log out on network error)
    const refreshFromDb = async (currentData: LocalUser) => {
      try {
        const allUsers = await getAllUsers(true)
        const dbUser = allUsers.find((u) => u.id === currentData.id)

        if (!dbUser) {
          // Account was explicitly deleted — log out
          localStorage.removeItem("currentUser")
          router.push("/login")
          return
        }

        if (
          dbUser.nickname !== currentData.nickname ||
          dbUser.role !== currentData.role ||
          dbUser.secondaryRole !== currentData.secondaryRole ||
          dbUser.customAvatar !== currentData.customAvatar ||
          dbUser.reportTag !== currentData.reportTag ||
          dbUser.gender !== currentData.gender
        ) {
          const updated = {
            id: dbUser.id,
            nickname: dbUser.nickname,
            role: dbUser.role,
            vkAccessToken: currentData.vkAccessToken || "",
            secondaryRole: dbUser.secondaryRole,
            customAvatar: dbUser.customAvatar,
            reportTag: dbUser.reportTag,
            gender: dbUser.gender,
          }
          localStorage.setItem("currentUser", JSON.stringify(updated))
          setUser(updated)
          window.dispatchEvent(new Event("userDataUpdated"))
        }
      } catch {
        // Network error — keep the user logged in, don't do anything
      }
    }

    refreshFromDb(userData)

    // SSE — listen for changes pushed from the server
    const sse = new EventSource("/api/users/stream")
    sse.onmessage = (e) => {
      if (e.data === "users_changed") {
        const latest = localStorage.getItem("currentUser")
        if (latest) {
          try {
            refreshFromDb(JSON.parse(latest))
          } catch { }
        }
      }
    }
    sse.onerror = () => {
      // SSE connection dropped — reconnect is automatic, ignore
    }

    const handleUserUpdate = () => {
      const latest = localStorage.getItem("currentUser")
      if (latest) {
        try {
          setUser(JSON.parse(latest))
        } catch { }
      }
    }

    window.addEventListener("userRoleUpdated", handleUserUpdate)
    window.addEventListener("userDataUpdated", handleUserUpdate)

    return () => {
      sse.close()
      window.removeEventListener("userRoleUpdated", handleUserUpdate)
      window.removeEventListener("userDataUpdated", handleUserUpdate)
    }
  }, [router])

  useEffect(() => {
    document.documentElement.style.setProperty("--scrollbar-color", getTieColor())
  }, [theme.colorTheme])

  const isTechAdmin =
    user?.role === "Тех. Администратор" || user?.secondaryRole === "Тех. Администратор"



  if (!user) {
    const spinColor = getThemeColor(theme.colorTheme)
    return (
      <div
        className="flex min-h-screen items-center justify-center flex-col gap-4"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <div
          className="w-12 h-12 rounded-full border-4 animate-spin"
          style={{
            borderColor: spinColor + "30",
            borderTopColor: spinColor,
          }}
        />
        <span className="text-sm font-mono" style={{ color: spinColor + "80" }}>
          Загрузка...
        </span>
      </div>
    )
  }

  return (
    <TechModeGuard isTechAdmin={isTechAdmin} currentUserNickname={user?.nickname} techMode={globalTechMode}>
    <div className="flex min-h-screen">
      {/* Fixed background layer */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${getBackgroundImage()})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        user={user}
      />
      <main
        className={`flex-1 transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-64"}`}
      >
        <div
          className={`min-h-screen ${theme.mode === "dark" ? "bg-black/70" : "bg-white/80"}`}
          style={{
            backdropFilter: `blur(${theme.blurAmount ?? 4}px)`,
            WebkitBackdropFilter: `blur(${theme.blurAmount ?? 4}px)`,
            transition: "backdrop-filter 0.4s ease, -webkit-backdrop-filter 0.4s ease",
          }}
        >
          <div className="p-6 space-y-4">
            <ContentSection activeSection={activeSection} onSectionChange={setActiveSection} userRole={user?.role} userNickname={user?.nickname} />
          </div>
        </div>
      </main>
    </div>
    </TechModeGuard>
  )
}

export function MainContent() {
  return (
    <ThemeProvider>
      <AccessProvider>
        <MainContentInner />
      </AccessProvider>
    </ThemeProvider>
  )
}
