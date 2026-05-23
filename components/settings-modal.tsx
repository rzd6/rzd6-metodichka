"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/contexts/theme-context"
import {
  Settings,
  Check,
  Camera,
  Upload,
  X,
  User,
  ImageIcon,
  Lock,
  Eye,
  EyeOff,
  Terminal,
  Palette,
  UserCog,
  Tag,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccessPermissionsPanel } from "@/components/settings/access-permissions-panel"
import { DEFAULT_REPORT_TAGS, type UserGender } from "@/data/roles"
import { ColorPicker } from "@/components/ui/color-picker"
import { getThemeColor } from "@/lib/theme-utils"
import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { updateUser } from "@/data/users"
import { ImageCropModal } from "@/components/image-crop-modal"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { theme, updateTheme } = useTheme()
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [techMode, setTechMode] = useState(false)
  const [techModeLoading, setTechModeLoading] = useState(false)
  const [settingsTab, setSettingsTab] = useState<"appearance" | "account">("appearance")
  const [reportTag, setReportTag] = useState("")
  const [gender, setGender] = useState<UserGender>("male")
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState("")

  // Password change
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOldPw, setShowOldPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState(false)

  // Custom background
  const [customBgPreview, setCustomBgPreview] = useState<string | null>(null)
  const bgFileInputRef = useRef<HTMLInputElement>(null)

  // Crop modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropMode, setCropMode] = useState<"avatar" | "background">("avatar")

  const getTieColor = () => getThemeColor(theme.colorTheme)

  const isTechAdmin = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("currentUser") || "null")
      return u?.role === "Тех. Администратор" || u?.secondaryRole === "Тех. Администратор"
    } catch { return false }
  })()

  useEffect(() => {
    if (open) {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null")
      setAvatarPreview(currentUser?.customAvatar || null)
      const savedBg = localStorage.getItem("rzd-custom-bg")
      setCustomBgPreview(savedBg || null)
      // Reset password fields on open
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPwError("")
      setPwSuccess(false)
      setProfileError("")
      setProfileSaved(false)
      const cu = JSON.parse(localStorage.getItem("currentUser") || "null")
      setReportTag(cu?.reportTag?.replace(/^\[|\]$/g, "") ?? "")
      setGender(cu?.gender === "female" ? "female" : "male")
      // Load current tech mode from Supabase
      fetch("/api/tech-mode")
        .then((r) => r.json())
        .then((d) => setTechMode(!!d.enabled))
        .catch(() => {})
    }
  }, [open])

  const handleToggleTechMode = async () => {
    setTechModeLoading(true)
    const newValue = !techMode
    try {
      const res = await fetch("/api/tech-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      })
      const data = await res.json()
      if (data.success) {
        setTechMode(newValue)
        // Notify main-content to update immediately without waiting for next poll
        window.dispatchEvent(new CustomEvent("techModeChanged", { detail: { enabled: newValue } }))
      }
    } catch {
      // Ignore error — state stays as-is
    } finally {
      setTechModeLoading(false)
    }
  }

  const handleChangePassword = async () => {
    setPwError("")
    setPwSuccess(false)
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPwError("Заполните все поля")
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError("Новые пароли не совпадают")
      return
    }
    if (newPassword.length < 4) {
      setPwError("Минимальная длина пароля — 4 символа")
      return
    }
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null")
    if (!currentUser?.id) { setPwError("Пользователь не найден"); return }
    // Verify old password
    if (currentUser.password && currentUser.password !== oldPassword) {
      setPwError("Неверный текущий пароль")
      return
    }
    setPwLoading(true)
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentUser.id, password: newPassword }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setPwError(json.error || "Ошибка при смене пароля")
        return
      }
      // Update localStorage
      localStorage.setItem("currentUser", JSON.stringify({ ...currentUser, password: newPassword }))
      setPwSuccess(true)
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      setPwError("Ошибка соединения")
    } finally {
      setPwLoading(false)
    }
  }

  // Avatar: open file → show crop modal
  const handleAvatarFileSelect = (file: File) => {
    setAvatarError("")
    const url = URL.createObjectURL(file)
    setCropMode("avatar")
    setCropSrc(url)
  }

  // Background: open file → show crop modal
  const handleBgFileSelect = (file: File) => {
    const url = URL.createObjectURL(file)
    setCropMode("background")
    setCropSrc(url)
  }

  // After crop confirmed — upload avatar
  const handleAvatarCropped = async (dataUrl: string) => {
    setAvatarPreview(dataUrl)
    setAvatarUploading(true)
    setAvatarError("")
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null")
      if (!currentUser?.id) { setAvatarError("Пользователь не найден"); setAvatarUploading(false); return }

      // Convert dataUrl → File for upload
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], "avatar.png", { type: "image/png" })

      const formData = new FormData()
      formData.append("file", file)

      const uploadRes = await fetch("/api/upload-to-imgbb", { method: "POST", body: formData })
      const data = await uploadRes.json()

      const url = data.urls?.[0]
      if (!uploadRes.ok || !url) {
        setAvatarError(data.error || "Ошибка загрузки")
        setAvatarPreview(currentUser.customAvatar || null)
        setAvatarUploading(false)
        return
      }

      await updateUser(currentUser.id, { customAvatar: url })
      localStorage.setItem("currentUser", JSON.stringify({ ...currentUser, customAvatar: url }))
      setAvatarPreview(url)
      window.dispatchEvent(new Event("userAvatarUpdated"))
    } catch {
      setAvatarError("Ошибка соединения")
    } finally {
      setAvatarUploading(false)
    }
  }

  // After crop confirmed — save background locally
  const handleBgCropped = (dataUrl: string) => {
    localStorage.setItem("rzd-custom-bg", dataUrl)
    setCustomBgPreview(dataUrl)
    window.dispatchEvent(new Event("customBgUpdated"))
  }

  const handleRemoveAvatar = async () => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null")
    if (currentUser) {
      await updateUser(currentUser.id, { customAvatar: "" })
      const { customAvatar: _, ...rest } = currentUser
      localStorage.setItem("currentUser", JSON.stringify(rest))
      window.dispatchEvent(new Event("userAvatarUpdated"))
    }
    setAvatarPreview(null)
    setAvatarError("")
  }

  const handleRemoveCustomBg = () => {
    localStorage.removeItem("rzd-custom-bg")
    setCustomBgPreview(null)
    window.dispatchEvent(new Event("customBgUpdated"))
  }

  const handleSaveProfile = async () => {
    setProfileError("")
    setProfileSaved(false)
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null")
    if (!currentUser?.id) {
      setProfileError("Пользователь не найден")
      return
    }
    setProfileSaving(true)
    try {
      const normalizedTag = reportTag.trim() ? reportTag.trim().replace(/^\[|\]$/g, "") : ""
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentUser.id,
          report_tag: normalizedTag || null,
          gender,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setProfileError(json.error || "Ошибка сохранения")
        return
      }
      const updated = {
        ...currentUser,
        reportTag: normalizedTag || undefined,
        gender,
      }
      localStorage.setItem("currentUser", JSON.stringify(updated))
      setProfileSaved(true)
      window.dispatchEvent(new Event("userDataUpdated"))
    } catch {
      setProfileError("Ошибка соединения")
    } finally {
      setProfileSaving(false)
    }
  }

  const previewTag = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("currentUser") || "null")
      if (reportTag.trim()) {
        const t = reportTag.trim().replace(/^\[|\]$/g, "")
        return `[${t}]`
      }
      return u?.role ? DEFAULT_REPORT_TAGS[u.role as keyof typeof DEFAULT_REPORT_TAGS] || "[ТЭГ]" : "[ТЭГ]"
    } catch {
      return "[ТЭГ]"
    }
  })()

  return (
    <>
      {/* Crop modal — outside Dialog to avoid nesting issues */}
      {cropSrc && (
        <ImageCropModal
          open={!!cropSrc}
          onOpenChange={(v) => { if (!v) setCropSrc(null) }}
          imageSrc={cropSrc}
          mode={cropMode}
          onCrop={cropMode === "avatar" ? handleAvatarCropped : handleBgCropped}
        />
      )}

    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${isTechAdmin ? "max-w-4xl" : "max-w-2xl"} max-h-[95vh] flex flex-col`}>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
            <Settings className="w-5 h-5" />
            Настройки
          </DialogTitle>
        </DialogHeader>

        <Tabs value={settingsTab} onValueChange={(v) => setSettingsTab(v as "appearance" | "account")} className="flex-1 flex flex-col min-h-0">
          <TabsList className={`grid w-full grid-cols-2 mb-4 ${theme.mode === "dark" ? "bg-white/10" : "bg-gray-100"}`}>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="w-4 h-4" />
              Оформление
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-2">
              <UserCog className="w-4 h-4" />
              Аккаунт и система
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="flex-1 overflow-y-auto space-y-6 pr-2 mt-0 data-[state=inactive]:hidden">

          {/* Avatar */}
          <div className="space-y-3">
            <Label className={`text-base flex items-center gap-2 ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
              <Camera className="w-4 h-4" style={{ color: getTieColor() }} />
              Аватар профиля
            </Label>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center border-2"
                  style={{ borderColor: getTieColor() }}
                >
                  {avatarPreview ? (
                    <Image src={avatarPreview} alt="Аватар" width={64} height={64} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: getTieColor() + "20" }}>
                      <User className="w-6 h-6" style={{ color: getTieColor() + "80" }} />
                    </div>
                  )}
                </div>
                {avatarPreview && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow hover:bg-red-600 transition-colors"
                    title="Удалить аватар"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                )}
              </div>
              {/* Upload */}
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFileSelect(f); e.target.value = "" }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="w-full h-10 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: getTieColor() + "60", color: getTieColor(), background: getTieColor() + "08" }}
                >
                  <Upload className="w-4 h-4" />
                  {avatarUploading ? "Загрузка..." : avatarPreview ? "Заменить фото" : "Загрузить фото"}
                </button>
                {avatarError && <p className="text-xs text-red-500">{avatarError}</p>}
              </div>
            </div>
          </div>

          {/* Custom background */}
          <div className="space-y-3">
            <Label className={`text-base flex items-center gap-2 ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
              <ImageIcon className="w-4 h-4" style={{ color: getTieColor() }} />
              Свой фон
            </Label>
            {customBgPreview && (
              <div className="relative rounded-lg overflow-hidden" style={{ height: 100 }}>
                <img src={customBgPreview} alt="Свой фон" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => bgFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-md bg-white/20 text-white text-xs font-medium backdrop-blur-sm hover:bg-white/30 transition-colors flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Заменить
                  </button>
                  <button
                    onClick={handleRemoveCustomBg}
                    className="px-3 py-1.5 rounded-md bg-red-500/80 text-white text-xs font-medium backdrop-blur-sm hover:bg-red-500 transition-colors flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Удалить
                  </button>
                </div>
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-medium text-white bg-black/50 backdrop-blur-sm flex items-center gap-1">
                  <Check className="w-3 h-3" style={{ color: getTieColor() }} />
                  Активен
                </div>
              </div>
            )}
            <input
              ref={bgFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBgFileSelect(f); e.target.value = "" }}
            />
            {!customBgPreview && (
              <button
                onClick={() => bgFileInputRef.current?.click()}
                className="w-full h-16 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 text-sm font-medium transition-all hover:opacity-80"
                style={{ borderColor: getTieColor() + "60", color: getTieColor(), background: getTieColor() + "08" }}
              >
                <Upload className="w-4 h-4" />
                Загрузить фон
              </button>
            )}
          </div>

          <div className="space-y-3">
            <Label className={`text-base ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
              Фон приложения
            </Label>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "https://s.fotora.ru/6a96e5fca340f26e.png", label: "Железнодорожный Мост" },
                { value: "https://s.fotora.ru/fb1e4a495e9b43b0.jpeg", label: "Двухэтажный поезд" },
                { value: "https://s.fotora.ru/b23a8a0e74f1e61b.png", label: "Паровозы в Петергофе" },
                { value: "https://s.fotora.ru/a6db37eb535c9e33.jpeg", label: "Грузовой поезд" },
                { value: "https://s.fotora.ru/b1ff6c2d12440e4b.png", label: "Зимний Сапсан" },
                { value: "https://s.fotora.ru/e15bd0c76b0d2cc9.jpeg", label: "Пассажирский ЭП2к" },
              ].map((bg) => (
                <button
                  key={bg.value}
                  onClick={() => updateTheme({ background: bg.value })}
                  className={`relative rounded-lg border-2 transition-all w-full overflow-hidden`}
                  style={{
                    borderColor: theme.background === bg.value ? getTieColor() : "rgba(255,255,255,0.2)",
                    boxShadow: theme.background === bg.value ? `0 0 0 2px ${getTieColor()}60` : undefined,
                  }}
                >
                  <img src={bg.value} alt={bg.label} className="h-32 w-full object-cover object-center" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white font-medium text-xs px-2 text-center">{bg.label}</span>
                  </div>
                  {theme.background === bg.value && (
                    <div className="absolute top-2 right-2 bg-white rounded-full p-1">
                      <Check className="w-3 h-3" style={{ color: getTieColor() }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className={`text-base ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>Шрифт</Label>
            <Select value={theme.fontFamily} onValueChange={(value) => updateTheme({ fontFamily: value })}>
              <SelectTrigger
                className={`${theme.mode === "dark" ? "bg-white/5 border-white/20 text-white" : "bg-white border-gray-300 text-gray-900"}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sans">Inter (по умолчанию)</SelectItem>
                <SelectItem value="roboto">Roboto</SelectItem>
                <SelectItem value="montserrat">Montserrat</SelectItem>
                <SelectItem value="nunito">Nunito</SelectItem>
                <SelectItem value="oswald">Oswald</SelectItem>
                <SelectItem value="merriweather">Merriweather</SelectItem>
                <SelectItem value="playfair">Playfair Display</SelectItem>
                <SelectItem value="serif">Serif</SelectItem>
                <SelectItem value="mono">Monospace (JetBrains)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Blur amount */}
          <div className="space-y-3 pt-2 border-t" style={{ borderColor: getTieColor() + "30" }}>
            <Label className={`text-base ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
              Размытие фона —{" "}
              <span style={{ color: getTieColor() }}>{theme.blurAmount ?? 4}px</span>
            </Label>
            <div className="flex items-center gap-3">
              <span className={`text-xs w-6 text-center ${theme.mode === "dark" ? "text-white/50" : "text-gray-400"}`}>0</span>
              <div className="relative flex-1 h-5 flex items-center">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${((theme.blurAmount ?? 4) / 20) * 100}%`,
                    backgroundColor: getTieColor(),
                    top: "50%",
                    transform: "translateY(-50%)",
                    height: "4px",
                  }}
                />
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: `${((theme.blurAmount ?? 4) / 20) * 100}%`,
                    right: 0,
                    backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
                    top: "50%",
                    transform: "translateY(-50%)",
                    height: "4px",
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={0.5}
                  value={theme.blurAmount ?? 4}
                  onChange={(e) => updateTheme({ blurAmount: Number(e.target.value) })}
                  className="relative w-full appearance-none bg-transparent cursor-pointer"
                  style={{
                    // Thumb styling via CSS vars isn't possible in Tailwind easily, use inline style for accent
                    accentColor: getTieColor(),
                  }}
                />
              </div>
              <span className={`text-xs w-6 text-center ${theme.mode === "dark" ? "text-white/50" : "text-gray-400"}`}>20</span>
            </div>
          </div>

          <div className="space-y-3 pb-2">
            <Label className={`text-base ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>Цветовая тема</Label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { value: "red", label: "Красная", gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)" },
                { value: "orange", label: "Оранжевая", gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)" },
                { value: "green", label: "Зелёная", gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)" },
                { value: "teal", label: "Бирюзовая", gradient: "linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)" },
                { value: "blue", label: "Синяя", gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)" },
                { value: "purple", label: "Фиолетовая", gradient: "linear-gradient(135deg, #a855f7 0%, #9333ea 50%, #7e22ce 100%)" },
              ].map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateTheme({ colorTheme: color.value })}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${theme.colorTheme === color.value ? "border-white/60 bg-white/10 shadow-lg scale-105" : "border-white/20 hover:border-white/40 bg-white/5"}`}
                  title={color.label}
                >
                  <div className={`w-12 h-12 rounded-lg border-2 overflow-hidden flex items-center justify-center ${theme.colorTheme === color.value ? "border-white scale-110" : "border-white/30"}`} style={{ background: color.gradient }}>
                    {theme.colorTheme === color.value && <Check className="w-6 h-6 text-white drop-shadow-lg" />}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <ColorPicker value={getTieColor()} onChange={(color) => updateTheme({ colorTheme: color })} label="Или выберите свой цвет" />
            </div>
          </div>

          </TabsContent>

          <TabsContent value="account" className="flex-1 overflow-y-auto space-y-6 pr-2 mt-0 data-[state=inactive]:hidden">

          <div className="space-y-3">
            <Label className={`text-base flex items-center gap-2 ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
              <Tag className="w-4 h-4" style={{ color: getTieColor() }} />
              Служебный тег в докладах
            </Label>
            <input
              value={reportTag}
              onChange={(e) => { setReportTag(e.target.value); setProfileSaved(false) }}
              placeholder="Например: ПЧ"
              className={`w-full h-10 rounded-lg border px-3 text-sm outline-none ${theme.mode === "dark" ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-300 text-black"}`}
            />
            <p className={`text-xs ${theme.mode === "dark" ? "text-white/50" : "text-gray-500"}`}>Подстановка в рации: {previewTag}</p>
          </div>

          <div className="space-y-3">
            <Label className={`text-base ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>Пол (склонения в докладах)</Label>
            <div className="grid grid-cols-2 gap-3">
              {([{ value: "male" as const, label: "Мужской" }, { value: "female" as const, label: "Женский" }]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setGender(opt.value); setProfileSaved(false) }}
                  className={`h-10 rounded-lg border-2 text-sm font-medium ${gender === opt.value ? "text-white" : ""}`}
                  style={gender === opt.value ? { borderColor: getTieColor(), backgroundColor: getTieColor() } : undefined}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSaveProfile} disabled={profileSaving} className="w-full h-10 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: getTieColor() }}>
            {profileSaving ? "Сохранение..." : profileSaved ? "Профиль сохранён" : "Сохранить тег и пол"}
          </button>
          {profileError && <p className="text-xs text-red-500">{profileError}</p>}

          <div className="space-y-3 pt-2 border-t" style={{ borderColor: getTieColor() + "30" }}>
            <Label className={`text-base flex items-center gap-2 ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
              <Lock className="w-4 h-4" style={{ color: getTieColor() }} />
              Смена пароля
            </Label>
            <div className="space-y-2">
              {/* Old password */}
              <div className="relative">
                <input
                  type={showOldPw ? "text" : "password"}
                  placeholder="Текущий пароль"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className={`w-full h-10 rounded-lg border px-3 pr-10 text-sm outline-none focus:ring-2 ${theme.mode === "dark" ? "bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:ring-white/20" : "bg-white border-gray-300 text-black placeholder:text-gray-400 focus:ring-gray-200"}`}
                />
                <button type="button" onClick={() => setShowOldPw(!showOldPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: getTieColor() }}>
                  {showOldPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* New password */}
              <div className="relative">
                <input
                  type={showNewPw ? "text" : "password"}
                  placeholder="Новый пароль"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`w-full h-10 rounded-lg border px-3 pr-10 text-sm outline-none focus:ring-2 ${theme.mode === "dark" ? "bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:ring-white/20" : "bg-white border-gray-300 text-black placeholder:text-gray-400 focus:ring-gray-200"}`}
                />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: getTieColor() }}>
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Confirm new password */}
              <div className="relative">
                <input
                  type={showConfirmPw ? "text" : "password"}
                  placeholder="Повторите новый пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full h-10 rounded-lg border px-3 pr-10 text-sm outline-none focus:ring-2 ${theme.mode === "dark" ? "bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:ring-white/20" : "bg-white border-gray-300 text-black placeholder:text-gray-400 focus:ring-gray-200"}`}
                />
                <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: getTieColor() }}>
                  {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwError && <p className="text-xs text-red-500 pl-1">{pwError}</p>}
              {pwSuccess && <p className="text-xs pl-1" style={{ color: getTieColor() }}>Пароль успешно изменён</p>}
              <button
                onClick={handleChangePassword}
                disabled={pwLoading}
                className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: getTieColor() }}
              >
                {pwLoading ? "Сохранение..." : "Сменить пароль"}
              </button>
            </div>
          </div>

          {/* Tech mode — only for tech admins */}
          {isTechAdmin && (
            <div className="space-y-3 pt-2 border-t" style={{ borderColor: getTieColor() + "30" }}>
              <Label className={`text-base flex items-center gap-2 ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
                <Terminal className="w-4 h-4" style={{ color: getTieColor() }} />
                Технический режим
              </Label>
              <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: getTieColor() + "40", background: getTieColor() + "08" }}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
                    Включить тех. режим
                  </p>
                  <p className={`text-xs mt-0.5 ${theme.mode === "dark" ? "text-white/50" : "text-gray-400"}`}>
                    {techMode
                      ? "Активен — посетители видят экран тех. работ"
                      : "Выключен — сайт работает в обычном режиме"}
                  </p>
                </div>
                <button
                  onClick={handleToggleTechMode}
                  disabled={techModeLoading}
                  className="relative flex-shrink-0 ml-4 w-12 h-6 rounded-full transition-all duration-300 focus:outline-none disabled:opacity-60"
                  style={{ backgroundColor: techMode ? getTieColor() : (theme.mode === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)") }}
                  role="switch"
                  aria-checked={techMode}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300"
                    style={{ transform: techMode ? "translateX(24px)" : "translateX(0)" }}
                  />
                </button>
              </div>
              {techMode && (
                <p className="text-xs px-1" style={{ color: getTieColor() }}>
                  Тех. администраторы могут войти в обычном режиме. Все остальные видят экран тех. работ.
                </p>
              )}
            </div>
          )}

          {/* removed duplicate color picker from account tab */}
          <div className="hidden" aria-hidden>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                {
                  value: "red",
                  label: "Красная",
                  gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)",
                },
                {
                  value: "orange",
                  label: "Оранжевая",
                  gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)",
                },
                {
                  value: "green",
                  label: "Зелёная",
                  gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)",
                },
                {
                  value: "teal",
                  label: "Бирюзовая",
                  gradient: "linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)",
                },
                {
                  value: "blue",
                  label: "Синяя",
                  gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)",
                },
                {
                  value: "purple",
                  label: "Фиолетовая",
                  gradient: "linear-gradient(135deg, #a855f7 0%, #9333ea 50%, #7e22ce 100%)",
                },
              ].map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateTheme({ colorTheme: color.value })}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${theme.colorTheme === color.value
                    ? "border-white/60 bg-white/10 shadow-lg scale-105"
                    : "border-white/20 hover:border-white/40 bg-white/5 hover:scale-102"
                    }`}
                  title={color.label}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-12 h-12 rounded-lg border-2 transition-all shadow-lg overflow-hidden flex items-center justify-center ${theme.colorTheme === color.value ? "border-white scale-110 shadow-xl" : "border-white/30"
                        }`}
                      style={{ background: color.gradient }}
                    >
                      {theme.colorTheme === color.value && <Check className="w-6 h-6 text-white drop-shadow-lg" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <ColorPicker
                value={getTieColor()}
                onChange={(color) => updateTheme({ colorTheme: color })}
                label="Или выберите свой цвет"
              />
            </div>
          </div>
          {isTechAdmin && (
            <div className="pt-2 border-t" style={{ borderColor: getTieColor() + "30" }}>
              <AccessPermissionsPanel />
            </div>
          )}

          </TabsContent>
        </Tabs>

        <div className="flex-shrink-0 pt-4 pb-2 border-t border-white/10 flex justify-center">
          <Button
            onClick={() => onOpenChange(false)}
            className="text-white font-semibold px-8 shadow-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: getTieColor() }}
          >
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
