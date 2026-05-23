"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getAllUsers, addUser, updateUser, deleteUser, isTechAdmin, type User } from "@/data/users"
import { useTheme } from "@/contexts/theme-context"
import { ASSIGNABLE_ROLES, sortUsersByRole, type UserRole } from "@/data/users"
import {
  Trash2,
  Edit,
  X,
  Check,
  Eye,
  EyeOff,
  Users,
  UserPlus,
  Crown,
  Shield,
  UsersRound,
  Wrench,
  Train,
  Link,
  Terminal,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Image from "next/image"
import { getThemeColor } from "@/lib/theme-utils"
import { getAvatarFilterFromColor } from "@/lib/color-utils"

function getCurrentUser() {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem("currentUser")
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch (e) {
      console.error("[v0] Error parsing current user:", e)
      return null
    }
  }
  return null
}

export function AdminSection() {
  const { theme } = useTheme()
  const [users, setUsers] = useState<User[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [newNickname, setNewNickname] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole] = useState<UserRole>("ПТО")
  const [editNickname, setEditNickname] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editRole, setEditRole] = useState<UserRole>("ПТО")
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({})
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [newVkId, setNewVkId] = useState("")
  const [newVkIdRaw, setNewVkIdRaw] = useState("")
  const [newVkResolving, setNewVkResolving] = useState(false)
  const [newVkResolveError, setNewVkResolveError] = useState("")
  const [editVkId, setEditVkId] = useState("")
  const [editVkIdRaw, setEditVkIdRaw] = useState("")
  const [vkResolving, setVkResolving] = useState(false)
  const [vkResolveError, setVkResolveError] = useState("")
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null)
  const [copiedVkId, setCopiedVkId] = useState<string | null>(null)
  const vkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const newVkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true)
      const loadedUsers = await getAllUsers()
      const sortedUsers = sortUsersByRole(loadedUsers)
      setUsers(sortedUsers)

      const current = getCurrentUser()
      setCurrentUser(current)
      setIsLoading(false)
    }

    loadUsers()

    const handleUserDataUpdate = () => {
      loadUsers()
    }

    window.addEventListener("userDataUpdated", handleUserDataUpdate)

    return () => {
      window.removeEventListener("userDataUpdated", handleUserDataUpdate)
    }
  }, [])

  const isCurrentTechAdmin = () =>
    isTechAdmin(currentUser?.role ?? "ЦдУД", currentUser?.secondaryRole)

  const canAddUser = () => {
    if (!currentUser) return false
    return currentUser.role === "Руководство" || currentUser.role === "Заместитель" || isCurrentTechAdmin()
  }

  /** Returns true if the target user is "protected" — has Тех. Администратор as primary or secondary role.
   *  Only another Тех. Администратор can act on such users. */
  const isTargetTechAdmin = (user: User) =>
    user.role === "Тех. Администратор" || user.secondaryRole === "Тех. Администратор"

  const canDeleteUser = (user: User) => {
    if (!currentUser) return false
    // Тех. Администратор targets can only be managed by another Тех. Администратор
    if (isTargetTechAdmin(user) && !isCurrentTechAdmin()) return false
    if (isCurrentTechAdmin()) return true
    if (currentUser.role === "Руководство") return true
    if (currentUser.role === "Заместитель") {
      return user.role === "ПТО" || user.role === "ЦдУД"
    }
    return false
  }

  const canEditUser = (user: User) => {
    if (!currentUser) return false
    // Тех. Администратор targets can only be managed by another Тех. Администратор
    if (isTargetTechAdmin(user) && !isCurrentTechAdmin()) return false
    if (isCurrentTechAdmin()) return true
    if (currentUser.role === "Руководство") return true
    if (currentUser.role === "Заместитель") {
      return user.role === "ПТО" || user.role === "ЦдУД"
    }
    if (currentUser.role === "Старший Состав") {
      return user.role === "ПТО" || user.role === "ЦдУД"
    }
    return false
  }

  const canSeePassword = (user: User) => {
    if (!currentUser) return false
    // Тех. Администратор targets can only be managed by another Тех. Администратор
    if (isTargetTechAdmin(user) && !isCurrentTechAdmin()) return false
    if (isCurrentTechAdmin()) return true
    if (currentUser.role === "Руководство") return true
    if (currentUser.role === "Заместитель") {
      return user.role === "ЦдУД" || user.role === "ПТО"
    }
    return false
  }

  const canChangeRole = (user: User) => {
    if (!currentUser) return false
    // Тех. Администратор targets can only be managed by another Тех. Администратор
    if (isTargetTechAdmin(user) && !isCurrentTechAdmin()) return false
    if (isCurrentTechAdmin()) return true
    if (currentUser.role === "Руководство") return true
    if (currentUser.role === "Заместитель") {
      return user.role === "ПТО" || user.role === "ЦдУД"
    }
    if (currentUser.role === "Старший Состав") {
      return user.role === "ПТО" || user.role === "ЦдУД"
    }
    return false
  }

  /**
   * Only Тех. Администратор (primary or secondary) can grant/revoke the
   * Тех. Администратор secondary role. Руководство alone cannot, and a
   * user with only the РЖД secondary role also cannot.
   */
  const canGrantTechAdmin = (user: User) => {
    if (!currentUser) return false
    if (user.id === currentUser.id) return false
    if (user.role === "Тех. Администратор") return false
    return isCurrentTechAdmin()
  }

  /**
   * Руководство and Тех. Администратор can grant/revoke the РЖД secondary
   * role. A user who only has the РЖД secondary role cannot grant it to others.
   */
  const canGrantRZD = (user: User) => {
    if (!currentUser) return false
    if (user.id === currentUser.id) return false
    if (user.role === "Руководство") return false
    // РЖД-only secondary holders cannot grant it; only primary Руководство or Тех. Администратор can
    if (currentUser.secondaryRole === "РЖД" && !isCurrentTechAdmin() && currentUser.role !== "Руководство") return false
    return currentUser.role === "Руководство" || isCurrentTechAdmin()
  }

  const handleToggleTechAdmin = async (user: User) => {
    const newSecondaryRole = user.secondaryRole === "Тех. Администратор" ? undefined : "Тех. Администратор"
    await updateUser(user.id, { secondaryRole: newSecondaryRole })
    const updatedUsers = await getAllUsers(true)
    setUsers(sortUsersByRole(updatedUsers))
    window.dispatchEvent(new Event("userDataUpdated"))
  }

  const handleToggleRZD = async (user: User) => {
    const newSecondaryRole = user.secondaryRole === "РЖД" ? undefined : "РЖД"
    await updateUser(user.id, { secondaryRole: newSecondaryRole })
    const updatedUsers = await getAllUsers(true)
    setUsers(sortUsersByRole(updatedUsers))
    window.dispatchEvent(new Event("userDataUpdated"))
  }

  const getAvailableRoles = (): UserRole[] => {
    if (!currentUser) return []
    if (currentUser.role === "Руководство" || isCurrentTechAdmin()) {
      return ASSIGNABLE_ROLES
    }
    if (currentUser.role === "Заместитель" || currentUser.role === "Старший Состав") {
      return ["ЦдУД", "ПТО"]
    }
    return []
  }

  const handleAddUser = async () => {
    if (newNickname && newPassword && canAddUser()) {
      await addUser(newNickname, newPassword, newRole, newVkId || undefined)
      const updatedUsers = await getAllUsers()
      const sortedUsers = sortUsersByRole(updatedUsers)
      setUsers(sortedUsers)
      setNewNickname("")
      setNewPassword("")
      setNewRole("ПТО")
      setNewVkId("")
      setNewVkIdRaw("")
      setNewVkResolveError("")
      setShowAddForm(false)
      window.dispatchEvent(new Event("userDataUpdated"))
    }
  }

  const handleDeleteUser = async (id: string) => {
    const user = users.find((u) => u.id === id)
    if (user && canDeleteUser(user)) {
      setDeleteConfirmUser(user)
    }
  }

  const confirmDeleteUser = async () => {
    if (!deleteConfirmUser) return
    await deleteUser(deleteConfirmUser.id)
    const updatedUsers = await getAllUsers()
    const sortedUsers = sortUsersByRole(updatedUsers)
    setUsers(sortedUsers)
    setDeleteConfirmUser(null)
    window.dispatchEvent(new Event("userDataUpdated"))
  }

  const handleStartEdit = (user: User) => {
    if (canEditUser(user)) {
      setEditingUser(user.id)
      setEditNickname(user.nickname)
      setEditPassword(user.password)
      setEditRole(user.role)
      const existingVkId = (user as any).vkId || ""
      setEditVkId(existingVkId)
      setEditVkIdRaw(existingVkId)
      setVkResolveError("")
    }
  }

  // Выполняет серверный резолвинг VK ника → числового ID
  const resolveVkInput = useCallback(async (raw: string) => {
    setVkResolving(true)
    setVkResolveError("")
    try {
      const res = await fetch("/api/vk/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: raw.trim() }),
      })
      const data = await res.json()
      if (data.user_id) {
        setEditVkId(data.user_id)
        setVkResolveError("")
      } else {
        setVkResolveError(data.error || "Не найдено")
        setEditVkId("")
      }
    } catch {
      setVkResolveError("Ошибка запроса")
    } finally {
      setVkResolving(false)
    }
  }, [])

  // Resolve for the NEW user form
  const resolveNewVkInput = useCallback(async (raw: string) => {
    setNewVkResolving(true)
    setNewVkResolveError("")
    try {
      const res = await fetch("/api/vk/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: raw.trim() }),
      })
      const data = await res.json()
      if (data.user_id) {
        setNewVkId(data.user_id)
        setNewVkResolveError("")
      } else {
        setNewVkResolveError(data.error || "Не найдено")
        setNewVkId("")
      }
    } catch {
      setNewVkResolveError("Ошибка запроса")
    } finally {
      setNewVkResolving(false)
    }
  }, [])

  const handleNewVkIdInput = (raw: string) => {
    setNewVkIdRaw(raw)
    setNewVkResolveError("")
    if (newVkDebounceRef.current) clearTimeout(newVkDebounceRef.current)
    if (!raw.trim()) {
      setNewVkId("")
      setNewVkResolving(false)
      return
    }
    if (/^\d+$/.test(raw.trim())) {
      setNewVkId(raw.trim())
      return
    }
    const slug = raw.match(/vk\.(?:com|ru)\/([^\s/?#]+)/i)?.[1] ?? raw.replace(/^@/, "").split(/[/?#]/)[0]
    const idDirect = slug.match(/^id(\d+)$/i)?.[1]
    if (idDirect) {
      setNewVkId(idDirect)
      return
    }
    setNewVkId("")
    newVkDebounceRef.current = setTimeout(() => resolveNewVkInput(raw), 600)
  }

  // Разбираем введённое значение и резолвим в числовой VK ID (с debounce 600мс)
  const handleVkIdInput = (raw: string) => {
    setEditVkIdRaw(raw)
    setVkResolveError("")

    // Сбрасываем предыдущий таймер
    if (vkDebounceRef.current) clearTimeout(vkDebounceRef.current)

    if (!raw.trim()) {
      setEditVkId("")
      setVkResolving(false)
      return
    }

    // Числовой ID — принимаем сразу без сетевого запроса
    if (/^\d+$/.test(raw.trim())) {
      setEditVkId(raw.trim())
      return
    }

    // id123456 — парсим прямо в браузере
    const slug = raw.match(/vk\.com\/([^\s/?#]+)/i)?.[1] ?? raw.replace(/^@/, "")
    const idDirect = slug.match(/^id(\d+)$/i)?.[1]
    if (idDirect) {
      setEditVkId(idDirect)
      return
    }

    // Для имён — ждём паузу в наборе перед отправкой запроса
    setEditVkId("")
    vkDebounceRef.current = setTimeout(() => resolveVkInput(raw), 600)
  }

  const handleSaveEdit = async (id: string) => {
    const user = users.find((u) => u.id === id)
    if (!user) return

    if (editNickname && editPassword) {
      if (currentUser?.role === "Старший Состав") {
        await updateUser(id, { nickname: editNickname, role: editRole, vkId: editVkId || undefined })
      } else {
        await updateUser(id, {
          nickname: editNickname,
          password: editPassword,
          role: editRole,
          vkId: editVkId || undefined,
        })
      }
      const updatedUsers = await getAllUsers()
      const sortedUsers = sortUsersByRole(updatedUsers)
      setUsers(sortedUsers)
      setEditingUser(null)

      if (currentUser && currentUser.id === id) {
        const allUsers = await getAllUsers()
        const updatedUser = allUsers.find((u) => u.id === id)
        if (updatedUser) {
          localStorage.setItem("currentUser", JSON.stringify(updatedUser))
          setCurrentUser(updatedUser)
        }
      }

      window.dispatchEvent(new Event("userDataUpdated"))
    }
  }

  const handleCancelEdit = () => {
    setEditingUser(null)
    setEditNickname("")
    setEditPassword("")
  }

  const getTieColor = () => getThemeColor(theme.colorTheme)

  const getAvatarFilter = () => {
    return getAvatarFilterFromColor(theme.colorTheme)
  }

  const getAvatarForRole = (role: User["role"]) => {
    const avatarMap: Record<User["role"], string> = {
      Руководство: "/avatars/management.png",
      Заместитель: "/avatars/senior-staff.png",
      "Старший Состав": "/avatars/senior-staff.png",
      ЦдУД: "/avatars/cdud.png",
      ПТО: "/avatars/pto.png",
      "Тех. Администратор": "/avatars/management.png",
    }
    return avatarMap[role] || "/avatars/senior-staff.png"
  }

  const getRoleIcon = (role: User["role"], size: "sm" | "md" = "md") => {
    const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5"
    const color = "#ffffff"

    switch (role) {
      case "Руководство":
        return <Crown className={iconSize} style={{ color }} />
      case "Заместитель":
        return <Shield className={iconSize} style={{ color }} />
      case "Старший Состав":
        return <UsersRound className={iconSize} style={{ color }} />
      case "ЦдУД":
        return <Train className={iconSize} style={{ color }} />
      case "ПТО":
        return <Wrench className={iconSize} style={{ color }} />
      case "Тех. Администратор":
        return <Terminal className={iconSize} style={{ color }} />
      default:
        return <Users className={iconSize} style={{ color }} />
    }
  }

  const getUserAvatar = (role: User["role"], customAvatar?: string) => {
    const src = customAvatar || getAvatarForRole(role) || "/placeholder.svg"
    const isCustom = !!customAvatar
    return (
      <div
        className="w-12 h-12 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-full border-2"
        style={{ borderColor: getTieColor() }}
      >
        <Image
          src={src}
          alt={role}
          width={48}
          height={48}
          className="w-full h-full object-cover object-center scale-110"
          style={isCustom ? undefined : { filter: getAvatarFilter() }}
        />
      </div>
    )
  }

  const getRoleBadge = (role: User["role"]) => {
    const iconSize = "w-3 h-3"
    const color = getTieColor()

    let icon
    switch (role) {
      case "Руководство":
        icon = <Crown className={iconSize} style={{ color }} />
        break
      case "Заместитель":
        icon = <Shield className={iconSize} style={{ color }} />
        break
      case "Старший Состав":
        icon = <UsersRound className={iconSize} style={{ color }} />
        break
      case "ЦдУД":
        icon = <Train className={iconSize} style={{ color }} />
        break
      case "ПТО":
        icon = <Wrench className={iconSize} style={{ color }} />
        break
      case "Тех. Администратор":
        icon = <Terminal className={iconSize} style={{ color }} />
        break
      default:
        icon = <Users className={iconSize} style={{ color }} />
    }

    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold flex-shrink-0"
        style={{ borderColor: color + "50", color, backgroundColor: color + "12" }}
      >
        {icon}
        {role}
      </span>
    )
  }

  return (
    <div className="space-y-6 opacity-95">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: getTieColor() + "40" }}>
        <div
          className="p-3 rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${getTieColor()}20, ${getTieColor()}10)`,
          }}
        >
          <Users className="w-6 h-6" style={{ color: getTieColor() }} />
        </div>
        <div className="flex-1">
          <h2 className="text-3xl font-bold" style={{ color: getTieColor() }}>
            Управление аккаунтами
          </h2>
          <p className={`text-sm ${theme.mode === "dark" ? "text-white/70" : "text-gray-600"}`}>
            Управление правами доступа и учётными записями
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-12 rounded-xl animate-pulse ${theme.mode === "dark" ? "bg-white/5" : "bg-gray-100"}`}
              style={{ opacity: 1 - i * 0.12 }}
            />
          ))}
        </div>
      ) : (
        <>
          {canAddUser() && (
            <Card
              className={`border-2 rounded-2xl overflow-hidden ${theme.mode === "dark" ? "bg-[#0f1419]/50 border-white/10" : "bg-white border-gray-200"
                }`}
            >
              <CardHeader className="border-b pb-4" style={{ borderColor: getTieColor() }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-3" style={{ color: getTieColor() }}>
                    <UserPlus className="w-5 h-5" />
                    Добавить сотрудника
                  </h3>
                  <Button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="text-white font-semibold shadow-lg"
                    style={{ backgroundColor: getTieColor() }}
                    size="lg"
                  >
                    <UserPlus className="w-5 h-5 mr-2" />
                    {showAddForm ? "Открыть форму" : "Добавить аккаунт"}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          )}

          {showAddForm && canAddUser() && (
            <Card
              className={`border-2 rounded-2xl overflow-hidden ${theme.mode === "dark" ? "bg-[#0f1419]/50 border-white/10" : "bg-white border-gray-200"
                }`}
            >
              <CardHeader
                className="border-b pb-4"
                style={{
                  borderColor: getTieColor(),
                }}
              >
                <h3 className="text-xl font-bold flex items-center gap-3" style={{ color: getTieColor() }}>
                  <UserPlus className="w-5 h-5" />
                  Новый аккаунт
                </h3>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${theme.mode === "dark" ? "text-white/90" : "text-gray-700"}`}>
                    Никнейм
                  </label>
                  <Input
                    placeholder="Введите никнейм..."
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    className={`h-12 ${theme.mode === "dark"
                        ? "bg-white/5 border-white/10 text-white"
                        : "bg-white border-gray-300 text-black"
                      }`}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${theme.mode === "dark" ? "text-white/90" : "text-gray-700"}`}>
                    Пароль
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="Введите пароль..."
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`h-12 pr-12 ${theme.mode === "dark"
                          ? "bg-white/5 border-white/10 text-white"
                          : "bg-white border-gray-300 text-black"
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                      style={{ color: getTieColor() }}
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${theme.mode === "dark" ? "text-white/90" : "text-gray-700"}`}>
                    Роль
                  </label>
                  <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                    <SelectTrigger
                      className={`h-12 ${theme.mode === "dark"
                          ? "bg-white/5 border-white/10 text-white"
                          : "bg-white border-gray-300 text-black"
                        }`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableRoles().map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* VK field for new user */}
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${theme.mode === "dark" ? "text-white/90" : "text-gray-700"} flex items-center gap-2`}>
                    <Link className="w-4 h-4" style={{ color: "#0077FF" }} />
                    VK (необязательно)
                  </label>
                  <div
                    className="flex items-center rounded-lg border overflow-hidden"
                    style={{
                      borderColor: newVkResolveError ? "#ef444450" : newVkId ? "#0077FF50" : undefined,
                    }}
                  >
                    <Input
                      placeholder="vk.com/id, @имя, ссылка или числовой ID"
                      value={newVkIdRaw}
                      onChange={(e) => handleNewVkIdInput(e.target.value)}
                      className={`h-12 border-0 rounded-none focus-visible:ring-0 ${theme.mode === "dark"
                          ? "bg-white/5 text-white placeholder:text-white/40"
                          : "bg-white text-black placeholder:text-gray-400"
                        }`}
                    />
                    {newVkResolving && (
                      <span className={`pr-3 text-xs ${theme.mode === "dark" ? "text-white/40" : "text-gray-400"}`}>
                        ...
                      </span>
                    )}
                  </div>
                  {!newVkResolving && newVkId && (
                    <p className="text-xs pl-1" style={{ color: "#0077FF" }}>
                      ID: {newVkId}
                    </p>
                  )}
                  {newVkResolveError && (
                    <p className="text-xs text-red-500 pl-1">{newVkResolveError}</p>
                  )}
                  {!newVkId && !newVkResolveError && (
                    <p className={`text-xs ${theme.mode === "dark" ? "text-white/40" : "text-gray-400"}`}>
                      Вставьте ссылку, короткое имя или числовой ID — распознаётся автоматически
                    </p>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleAddUser}
                    className="flex-1 text-white font-semibold h-12"
                    style={{ backgroundColor: getTieColor() }}
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Создать аккаунт
                  </Button>
                  <Button
                    onClick={() => setShowAddForm(false)}
                    variant="outline"
                    className={`flex-1 h-12 ${theme.mode === "dark" ? "border-white/20 hover:bg-white/5" : "border-gray-300 hover:bg-gray-50"}`}
                  >
                    <X className="w-5 h-5 mr-2" />
                    Отмена
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {users.length === 0 ? (
              <div className="text-center py-8">
                <p className={`text-sm ${theme.mode === "dark" ? "text-white/70" : "text-gray-600"}`}>
                  Нет пользователей для отображения
                </p>
              </div>
            ) : (
              users.map((user) => (
                <Card
                  key={user.id}
                  className={`border-2 rounded-xl overflow-hidden transition-all duration-200 ${theme.mode === "dark"
                      ? "bg-[#0f1419]/50 border-white/10 hover:border-white/20"
                      : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                >
                  <CardContent className="px-3 py-2.5">
                    {editingUser === user.id ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          {getUserAvatar(editRole)}
                          <Input
                            value={editNickname}
                            onChange={(e) => setEditNickname(e.target.value)}
                            className={`flex-1 h-9 ${theme.mode === "dark"
                                ? "bg-white/5 border-white/10 text-white"
                                : "bg-white border-gray-300 text-black"
                              }`}
                          />
                        </div>
                        {canSeePassword(user) && (
                          <div className="relative">
                            <Input
                              type={showEditPassword ? "text" : "password"}
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              placeholder="Пароль"
                              className={`h-9 pr-12 ${theme.mode === "dark"
                                  ? "bg-white/5 border-white/10 text-white"
                                  : "bg-white border-gray-300 text-black"
                                }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowEditPassword(!showEditPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2"
                              style={{ color: getTieColor() }}
                            >
                              {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                        {canChangeRole(user) && (
                          <Select value={editRole} onValueChange={(value) => setEditRole(value as UserRole)}>
                            <SelectTrigger
                              className={`h-9 ${theme.mode === "dark"
                                  ? "bg-white/5 border-white/10 text-white"
                                  : "bg-white border-gray-300 text-black"
                                }`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableRoles().map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {/* VK ID field — принимает ссылку, короткое имя или числовой ID */}
                        <div className="flex flex-col gap-1">
                          <div
                            className="flex items-center rounded-lg border overflow-hidden"
                            style={{
                              borderColor: vkResolveError
                                ? "#ef4444"
                                : editVkId
                                ? "#0077FF50"
                                : undefined,
                            }}
                          >
                            <span
                              className={`px-2 text-xs flex-shrink-0 border-r h-9 flex items-center gap-1 ${theme.mode === "dark" ? "bg-white/5 border-white/10 text-white/40" : "bg-gray-50 border-gray-300 text-gray-400"}`}
                            >
                              <Link className="w-3 h-3" style={{ color: "#0077FF" }} />
                              ВК
                            </span>
                            <Input
                              placeholder="vk.com/имя, @имя или ID"
                              value={editVkIdRaw}
                              onChange={(e) => handleVkIdInput(e.target.value)}
                              className={`h-9 border-0 rounded-none focus-visible:ring-0 text-xs ${theme.mode === "dark"
                                  ? "bg-white/5 text-white placeholder:text-white/40"
                                  : "bg-white text-black placeholder:text-gray-400"
                                }`}
                            />
                            {vkResolving && (
                              <span className="pr-2 text-xs text-white/40">...</span>
                            )}
                            {!vkResolving && editVkId && (
                              <span className="pr-2 text-xs font-mono" style={{ color: "#0077FF" }}>
                                {editVkId}
                              </span>
                            )}
                          </div>
                          {vkResolveError && (
                            <p className="text-xs text-red-500 pl-1">{vkResolveError}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleSaveEdit(user.id)}
                            className="flex-1 text-white font-semibold h-9"
                            style={{ backgroundColor: getTieColor() }}
                            size="sm"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Сохранить
                          </Button>
                          <Button
                            onClick={handleCancelEdit}
                            variant="outline"
                            size="sm"
                            className={`flex-1 h-9 ${theme.mode === "dark" ? "border-white/20" : "border-gray-300"}`}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {getUserAvatar(user.role, user.customAvatar)}

                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            {/* Строка 1: имя + роль-бейдж */}
                            <div className="flex items-center gap-1.5">
                              <h3
                                className={`text-sm font-bold truncate ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}
                              >
                                {user.nickname}
                              </h3>
                              {getRoleBadge(user.role)}
                              {user.secondaryRole === "Тех. Администратор" && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold flex-shrink-0"
                                  style={{ borderColor: getTieColor() + "50", color: getTieColor(), backgroundColor: getTieColor() + "12" }}
                                  title="Дополнительная роль: Тех. Администратор"
                                >
                                  <Terminal className="w-3 h-3" />
                                  Тех. Адм.
                                </span>
                              )}
                              {user.secondaryRole === "РЖД" && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold flex-shrink-0"
                                  style={{ borderColor: getTieColor() + "50", color: getTieColor(), backgroundColor: getTieColor() + "12" }}
                                  title="Дополнительная роль: РЖД"
                                >
                                  <Crown className="w-3 h-3" />
                                  РЖД
                                </span>
                              )}
                            </div>
                            {/* Строка 2: должность + VK-кнопка */}
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <div
                                className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
                                style={{ color: getTieColor() }}
                              >
                                {getRoleIcon(user.role, "sm")}
                              </div>
                              <p
                                className={`text-xs truncate ${theme.mode === "dark" ? "text-white/70" : "text-gray-600"}`}
                              >
                                {user.role}
                              </p>
                              {user.vkId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigator.clipboard.writeText(`https://vk.com/id${user.vkId}`)
                                    setCopiedVkId(user.id)
                                    setTimeout(() => setCopiedVkId(null), 1400)
                                  }}
                                  title="Скопировать ссылку на VK"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-white text-xs font-medium transition-colors"
                                  style={{
                                    backgroundColor: copiedVkId === user.id ? "#16a34a" : "#0077FF",
                                  }}
                                >
                                  {copiedVkId === user.id ? (
                                    <>
                                      <Check className="w-3 h-3 flex-shrink-0" />
                                      <span>Скопировано</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.523-2.049-1.713-1.033-1.01-1.49-1.146-1.745-1.146-.356 0-.458.103-.458.6v1.564c0 .43-.136.686-1.27.686-1.865 0-3.932-1.129-5.387-3.236C4.937 11.57 4.22 9.436 4.22 9.003c0-.254.102-.491.6-.491h1.744c.447 0 .617.204.789.682.869 2.509 2.324 4.708 2.927 4.708.224 0 .326-.103.326-.668V10.64c-.067-1.198-.7-1.3-.7-1.727 0-.204.167-.408.433-.408h2.744c.375 0 .51.2.51.63v3.39c0 .375.167.51.272.51.224 0 .41-.136.82-.547 1.27-1.42 2.175-3.607 2.175-3.607.12-.254.326-.491.773-.491h1.744c.525 0 .64.27.525.63-.22.99-2.361 4.049-2.361 4.049-.187.306-.254.44 0 .783.188.256.8.783 1.21 1.256.748.852 1.32 1.565 1.474 2.059.153.477-.09.72-.573.72z" />
                                      </svg>
                                      <span className="font-mono">id{user.vkId}</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {canSeePassword(user) && (
                            <div className="flex items-center gap-1">
                              <p
                                className={`text-xs font-mono ${theme.mode === "dark" ? "text-white/60" : "text-gray-500"}`}
                              >
                                {showPasswords[user.id] ? user.password : "••••••••"}
                              </p>
                              <button
                                onClick={() => setShowPasswords((prev) => ({ ...prev, [user.id]: !prev[user.id] }))}
                                className={`p-1 rounded transition-colors ${theme.mode === "dark" ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
                                style={{ color: getTieColor() }}
                              >
                                {showPasswords[user.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1.5 ml-auto flex-shrink-0">
                          {canGrantTechAdmin(user) && (
                            <Button
                              onClick={() => handleToggleTechAdmin(user)}
                              variant="outline"
                              size="sm"
                              title={user.secondaryRole === "Тех. Администратор" ? "Снять Тех. Администратора" : "Выдать Тех. Администратора"}
                              className={`h-8 w-8 p-0 transition-all ${
                                user.secondaryRole === "Тех. Администратор"
                                  ? "border-amber-500 text-amber-500 hover:bg-amber-500/10"
                                  : theme.mode === "dark"
                                  ? "border-white/20 hover:bg-white/5"
                                  : "border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              <Terminal className="w-4 h-4" />
                            </Button>
                          )}

                          {canEditUser(user) && (
                            <Button
                              onClick={() => handleStartEdit(user)}
                              variant="outline"
                              size="sm"
                              className={`h-8 w-8 p-0 ${theme.mode === "dark" ? "border-white/20 hover:bg-white/5" : "border-gray-300 hover:bg-gray-50"}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {canDeleteUser(user) && (
                            <Button
                              onClick={() => handleDeleteUser(user.id)}
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 border-red-500/50 text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmUser} onOpenChange={(open) => !open && setDeleteConfirmUser(null)}>
        <AlertDialogContent
          className={`border-2 rounded-2xl ${theme.mode === "dark" ? "bg-[#0f1419] border-white/10" : "bg-white border-gray-200"}`}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className={`text-xl font-bold ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Удалить аккаунт?
            </AlertDialogTitle>
            <AlertDialogDescription className={`text-base ${theme.mode === "dark" ? "text-white/70" : "text-gray-600"}`}>
              Вы действительно хотите удалить аккаунт{" "}
              <span className="font-semibold" style={{ color: getTieColor() }}>
                {deleteConfirmUser?.nickname}
              </span>
              ? Это действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className={`flex-1 h-11 font-medium ${theme.mode === "dark" ? "bg-white/5 border-white/10 text-white hover:bg-white/10" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="flex-1 h-11 font-semibold text-white bg-red-600 hover:bg-red-700 border-0"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
