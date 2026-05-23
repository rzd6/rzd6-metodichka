"use client"

import type React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit, Check, Bell, Upload, X, UserRound, Users } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useTheme } from "@/contexts/theme-context"
import type { UserRole } from "@/data/users"
import { canPostAsFaction } from "@/data/users"
import { getArticles, createArticle, updateArticle, deleteArticle, type Article } from "@/lib/supabase-rzd"
import { useToast } from "@/hooks/use-toast"
import { getThemeColor } from "@/lib/theme-utils"
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

// Renders article content. If it contains an <iframe> tag (as stored HTML text),
// we split on iframes and render them as real iframe elements with auto-height.
function ArticleContent({ content, isDark }: { content: string; isDark: boolean }) {
  // Match self-closing or open/close iframe tags
  const iframeRegex = /(<iframe[\s\S]*?(?:\/>|<\/iframe>))/gi
  const parts = content.split(iframeRegex)

  return (
    <div className={`text-sm mb-2 leading-relaxed ${isDark ? "text-white/70" : "text-gray-600"}`}>
      {parts.map((part, i) => {
        if (/^<iframe/i.test(part)) {
          // Extract src attribute
          const srcMatch = part.match(/src=["']([^"']+)["']/i)
          const src = srcMatch ? srcMatch[1] : null
          if (!src) return null
          return <AutoIframe key={i} src={src} />
        }
        // Plain text — preserve newlines
        return part ? (
          <span key={i} className="whitespace-pre-wrap">{part}</span>
        ) : null
      })}
    </div>
  )
}

// iframe with automatic height adjustment via postMessage from the child page,
// falling back to reading scrollHeight for same-origin content.
function AutoIframe({ src }: { src: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(300)

  const adjustHeight = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc?.body) {
        const h = doc.documentElement.scrollHeight || doc.body.scrollHeight
        if (h > 50) setHeight(h)
      }
    } catch {
      // Cross-origin — height stays at last known value
    }
  }, [])

  // Listen for postMessage from the child page if it sends its height
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data && typeof e.data === "object" && e.data.iframeHeight) {
        setHeight(Number(e.data.iframeHeight))
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  return (
    <iframe
      ref={iframeRef}
      src={src}
      onLoad={adjustHeight}
      scrolling="no"
      style={{
        width: "100%",
        height: `${height}px`,
        border: "none",
        borderRadius: "8px",
        display: "block",
        margin: "8px 0",
        overflow: "hidden",
      }}
    />
  )
}

interface RZDWebsiteSectionProps {
  userRole: UserRole
  userNickname?: string
}

const ALL_ROLES: UserRole[] = ["Руководство", "Тех. Администратор", "Заместитель", "Старший Состав", "ЦдУД", "ПТО"]

// Roles that can author and view announcements
const AUTHOR_ROLES: UserRole[] = ["Руководство", "Заместитель", "Старший Состав", "Тех. Администратор"]

export function RZDWebsiteSection({ userRole, userNickname }: RZDWebsiteSectionProps) {
  const { theme } = useTheme()
  const { toast } = useToast()
  const [articles, setArticles] = useState<Article[]>([])
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [showArticleForm, setShowArticleForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([...ALL_ROLES])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [postAsFaction, setPostAsFaction] = useState(false)
  const [deleteConfirmArticle, setDeleteConfirmArticle] = useState<Article | null>(null)

  const getTieColor = () => getThemeColor(theme.colorTheme)
  const canPost = canPostAsFaction(userRole) || userRole === "Заместитель" || userRole === "Старший Состав"
  const canDelete = canPostAsFaction(userRole) // Only leadership/tech admin can delete any post
  const canEdit = canPostAsFaction(userRole)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const articlesData = await getArticles()
      setArticles(articlesData)
    } catch (err: any) {
      toast({
        title: "Ошибка загрузки",
        description: err?.message || "Не удалось загрузить уведомления. Проверьте подключение к Supabase.",
        variant: "destructive",
      })
      setArticles([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"))
    if (files.length > 0) {
      setSelectedImages((prev) => [...prev, ...files])
    } else {
      toast({ title: "Ошибка", description: "Пожалуйста, выберите изображения", variant: "destructive" })
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"))
      if (imageFiles.length > 0) {
        setSelectedImages((prev) => [...prev, ...imageFiles])
      } else {
        toast({ title: "Ошибка", description: "Пожалуйста, выберите изображения", variant: "destructive" })
      }
    }
    e.target.value = ""
  }

  const uploadImageToSupabase = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("nickname", userNickname || "Unknown")
      formData.append("activityType", "Уведомление")
      formData.append("title", `Изображение_${Date.now()}`)

      const response = await fetch("/api/upload-to-supabase", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Не удалось загрузить изображение")
      }

      const result = await response.json()
      return result.url
    } catch {
      return null
    }
  }

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const resetForm = () => {
    setShowArticleForm(false)
    setEditingArticle(null)
    setSelectedRoles([...ALL_ROLES])
    setSelectedImages([])
    setPostAsFaction(false)
  }

  const handleSaveAnnouncement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const title = formData.get("title") as string
    const content = formData.get("content") as string

    let imageUrls: string[] = []
    if (selectedImages.length > 0) {
      setIsUploading(true)
      for (const image of selectedImages) {
        const url = await uploadImageToSupabase(image)
        if (url) imageUrls.push(url)
      }
      setIsUploading(false)
    }

    if (editingArticle?.image_url) {
      imageUrls = [...(editingArticle.image_url || []), ...imageUrls]
    }

    const authData = localStorage.getItem("currentUser")
    let userId = ""
    let authorName = userNickname || "Неизвестный"

    if (authData) {
      try {
        const userData = JSON.parse(authData)
        userId = userData.id || ""
        authorName = userData.nickname || userNickname || "Неизвестный"
      } catch { }
    }

    // If posting as faction — override author name
    const finalAuthorName = postAsFaction ? "Группа РЖД" : authorName

    setIsLoading(true)
    try {
      if (editingArticle) {
        const updateData: Partial<Article> = {
          title,
          content,
          allowed_roles: selectedRoles,
        }
        if (imageUrls.length > 0) updateData.image_url = imageUrls

        await updateArticle(editingArticle.id, updateData)
        await loadData()
        toast({ title: "Успешно", description: "Уведомление обновлено" })
      } else {
        const articleData: Omit<Article, "id" | "created_at" | "updated_at"> = {
          title,
          content,
          author_name: finalAuthorName,
          author_id: userId,
          is_published: true,
          allowed_roles: selectedRoles,
          ...(imageUrls.length > 0 ? { image_url: imageUrls } : {}),
        }

        await createArticle(articleData)
        await loadData()
        const recipientRoles = selectedRoles.filter(r => !AUTHOR_ROLES.includes(r))
        toast({
          title: "Уведомление опубликовано",
          description: recipientRoles.length > 0
            ? `Видно ролям: ${selectedRoles.join(", ")}`
            : "Видно только руководящему составу",
        })
      }
      resetForm()
    } catch (err: any) {
      toast({
        title: "Ошибка сохранения",
        description: err?.message || "Не удалось сохранить уведомление. Проверьте подключение к Supabase.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAnnouncement = (article: Article) => {
    setDeleteConfirmArticle(article)
  }

  const confirmDeleteAnnouncement = async () => {
    if (!deleteConfirmArticle) return
    setIsLoading(true)
    try {
      await deleteArticle(deleteConfirmArticle.id)
      await loadData()
      toast({ title: "Успешно", description: "Уведомление удалено" })
      setDeleteConfirmArticle(null)
    } catch (err: any) {
      toast({
        title: "Ошибка удаления",
        description: err?.message || "Не удалось удалить уведомление",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getAuthorBadge = (article: Article) => {
    const isFaction = article.author_name === "Группа РЖД"
    return (
      <div className="flex items-center gap-1.5">
        {isFaction ? (
          <Users className="w-3.5 h-3.5" style={{ color: getTieColor() }} />
        ) : (
          <UserRound className="w-3.5 h-3.5 opacity-60" />
        )}
        <span
          className="text-sm font-medium"
          style={isFaction ? { color: getTieColor() } : {}}
        >
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

  const forumBg = "#22242b"

  return (
    <div className="space-y-6 opacity-95">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: getTieColor() + "40" }}>
        <div
          className="p-3 rounded-xl"
          style={{ background: `linear-gradient(135deg, ${getTieColor()}20, ${getTieColor()}10)` }}
        >
          <Bell className="w-6 h-6" style={{ color: getTieColor() }} />
        </div>
        <div>
          <h2 className="text-3xl font-bold" style={{ color: getTieColor() }}>
            Официальные уведомления
          </h2>
          <p className={`text-sm ${theme.mode === "dark" ? "text-white/70" : "text-gray-600"}`}>
            Служебные сообщения для старшего состава, заместителей и руководства
          </p>
        </div>
      </div>

      {/* Notification info banner */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl border"
        style={{
          backgroundColor: getTieColor() + "12",
          borderColor: getTieColor() + "30",
        }}
      >
        <Bell className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: getTieColor() }} />
        <p className={`text-sm leading-relaxed ${theme.mode === "dark" ? "text-white/80" : "text-gray-700"}`}>
          Уведомления видны ролям, которые выбраны при публикации. Сотрудники могут просмотреть их через кнопку
          колокольчика в боковой панели.
        </p>
      </div>

      <Card
        className="border-2 rounded-2xl"
        style={
          theme.mode === "dark"
            ? { backgroundColor: forumBg, borderColor: "rgba(255,255,255,0.1)" }
            : { backgroundColor: "#fff", borderColor: "#e5e7eb" }
        }
      >
        {canPost && (
          <CardHeader className="border-b pb-6" style={{ borderColor: getTieColor() }}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-3" style={{ color: getTieColor() }}>
                  <Edit className="w-6 h-6" />
                  Управление уведомлениями
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Создание и редактирование официальных уведомлений
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setEditingArticle(null)
                  setSelectedRoles([...ALL_ROLES])
                  setShowArticleForm(true)
                  setSelectedImages([])
                  setPostAsFaction(false)
                }}
                className="text-white text-base font-bold h-12 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                style={{ backgroundColor: getTieColor(), boxShadow: `0 4px 20px ${getTieColor()}40` }}
                disabled={isLoading}
              >
                <Plus className="w-5 h-5 mr-2" />
                Новое уведомление
              </Button>
            </div>
          </CardHeader>
        )}

        <CardContent className="pt-8">
          {/* Form */}
          {canPost && showArticleForm && (
            <form
              onSubmit={handleSaveAnnouncement}
              className="space-y-6 mb-8 p-6 rounded-xl"
              style={{
                backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="title" className="text-base font-medium">
                  Заголовок
                </Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={editingArticle?.title}
                  required
                  placeholder="Введите заголовок уведомления..."
                  className={`h-12 text-base ${theme.mode === "dark"
                      ? "bg-white/5 border-white/10 text-white placeholder:text-white/40"
                      : "bg-white border-gray-300 text-black placeholder:text-gray-400"
                    }`}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content" className="text-base font-medium">
                  Текст уведомления
                </Label>
                <Textarea
                  id="content"
                  name="content"
                  defaultValue={editingArticle?.content}
                  required
                  placeholder="Введите текст официального уведомления..."
                  rows={8}
                  className={`text-base ${theme.mode === "dark"
                      ? "bg-white/5 border-white/10 text-white placeholder:text-white/40"
                      : "bg-white border-gray-300 text-black placeholder:text-gray-400"
                    }`}
                />
              </div>

              {/* Author toggle — only for Руководство / Тех. Администратор */}
              {canPostAsFaction(userRole) && (
                <div className="space-y-2">
                  <Label className="text-base font-medium">От чьего имени публикуется</Label>
                  <div
                    className={`flex rounded-xl overflow-hidden border-2 ${theme.mode === "dark" ? "border-white/10" : "border-gray-200"
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => setPostAsFaction(false)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-all duration-200 ${!postAsFaction
                          ? "text-white"
                          : theme.mode === "dark"
                            ? "text-white/60 hover:text-white/80"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      style={!postAsFaction ? { backgroundColor: getTieColor() } : {}}
                    >
                      <UserRound className="w-4 h-4" />
                      От своего имени
                      {!postAsFaction && (
                        <span className="ml-1 opacity-80 text-xs">({userNickname})</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostAsFaction(true)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-all duration-200 ${postAsFaction
                          ? "text-white"
                          : theme.mode === "dark"
                            ? "text-white/60 hover:text-white/80"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      style={postAsFaction ? { backgroundColor: getTieColor() } : {}}
                    >
                      <Users className="w-4 h-4" />
                      От имени фракции
                      {postAsFaction && <span className="ml-1 opacity-80 text-xs">(Группа РЖД)</span>}
                    </button>
                  </div>
                </div>
              )}

              {/* Role visibility selector */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Кому видно уведомление</Label>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.map((role) => {
                    const isSelected = selectedRoles.includes(role)
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          setSelectedRoles(prev =>
                            isSelected ? prev.filter(r => r !== role) : [...prev, role]
                          )
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all duration-150"
                        style={
                          isSelected
                            ? { backgroundColor: getTieColor(), borderColor: getTieColor(), color: "#fff" }
                            : {
                              backgroundColor: "transparent",
                              borderColor: getTieColor() + "40",
                              color: theme.mode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                            }
                        }
                      >
                        {role}
                      </button>
                    )
                  })}
                </div>
                {selectedRoles.length === 0 && (
                  <p className="text-xs text-red-500">Выберите хотя бы одну роль</p>
                )}
              </div>

              {/* Image upload */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Изображения (необязательно)</Label>
                <div
                  className="flex flex-col items-center justify-center gap-4 p-8 rounded-lg border text-center cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, ${getTieColor()}10, ${getTieColor()}05)`,
                    borderColor: getTieColor() + "30",
                  }}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div
                    className="p-4 rounded-full transition-colors duration-200"
                    style={{ backgroundColor: getTieColor() + (isDragging ? "30" : "15") }}
                  >
                    <Upload className="w-8 h-8" style={{ color: getTieColor() }} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium">
                      {isDragging ? "Отпустите изображения для загрузки" : "Перетащите изображения сюда"}
                    </p>
                    <p className="text-sm text-muted-foreground">или</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("announcementImageInput")?.click()}
                      className="border-2"
                      style={{ borderColor: getTieColor() + "50", color: getTieColor() }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Выбрать файлы
                    </Button>
                    <input
                      id="announcementImageInput"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                </div>

                {(selectedImages.length > 0 ||
                  (editingArticle?.image_url && editingArticle.image_url.length > 0)) && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                      {editingArticle?.image_url?.map((url, index) => (
                        <div key={`existing-${index}`} className="relative group">
                          <img
                            src={url || "/placeholder.svg"}
                            alt={`Existing ${index + 1}`}
                            className="w-full max-h-48 h-auto object-contain rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              if (editingArticle) {
                                setEditingArticle({
                                  ...editingArticle,
                                  image_url: editingArticle.image_url?.filter((_, i) => i !== index),
                                })
                              }
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {selectedImages.map((file, index) => (
                        <div key={`new-${index}`} className="relative group">
                          <img
                            src={URL.createObjectURL(file) || "/placeholder.svg"}
                            alt={`Preview ${index + 1}`}
                            className="w-full max-h-48 h-auto object-contain rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  className="text-white text-lg font-bold h-12 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                  style={{ backgroundColor: getTieColor(), boxShadow: `0 4px 20px ${getTieColor()}40` }}
                  disabled={isLoading || isUploading || selectedRoles.length === 0}
                >
                  {isUploading
                    ? "Загрузка..."
                    : editingArticle
                      ? "Сохранить изменения"
                      : "Опубликовать уведомление"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 px-6 text-base bg-transparent"
                  onClick={resetForm}
                >
                  Отмена
                </Button>
              </div>
            </form>
          )}

          {/* Announcements list */}
          <div className="space-y-4">
            {isLoading && articles.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-lg">Загрузка...</p>
            ) : articles.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-lg">Официальные уведомления отсутствуют</p>
            ) : (
              articles.map((article) => (
                <div
                  key={article.id}
                  className="p-4 rounded-xl border-2 transition-all duration-200"
                  style={{
                    borderLeftWidth: "4px",
                    borderLeftColor: getTieColor(),
                    backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)",
                    borderColor: theme.mode === "dark" ? "rgba(255,255,255,0.1)" : "#e5e7eb",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {article.image_url && article.image_url.length > 0 && (
                        <div
                          className={`mb-4 ${article.image_url.length === 1
                              ? "flex justify-center"
                              : "grid grid-cols-2 md:grid-cols-3 gap-3"
                            }`}
                        >
                          {article.image_url.map((url, index) => (
                            <img
                              key={index}
                              src={url || "/placeholder.svg"}
                              alt={`${article.title} - изображение ${index + 1}`}
                              className={`rounded-lg ${article.image_url!.length === 1
                                  ? "max-w-md w-auto h-auto"
                                  : "w-full max-h-64 h-auto object-contain"
                                }`}
                            />
                          ))}
                        </div>
                      )}

                      <h3
                        className={`font-bold text-base mb-1.5 ${theme.mode === "dark" ? "text-white" : "text-gray-900"
                          }`}
                      >
                        {article.title}
                      </h3>

                      <ArticleContent
                        content={article.content}
                        isDark={theme.mode === "dark"}
                      />

                      <div className="flex items-center gap-4 flex-wrap mt-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(article.created_at).toLocaleDateString("ru-RU", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {(canEdit || canDelete) && (
                      <div className="flex gap-2">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-10 w-10 p-0 bg-transparent"
                            onClick={() => {
                              setEditingArticle(article)
                              setSelectedRoles(article.allowed_roles as UserRole[] || [])
                              setShowArticleForm(true)
                              setSelectedImages([])
                              setPostAsFaction(article.author_name === "Группа РЖД")
                            }}
                            disabled={isLoading}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-10 w-10 p-0"
                            onClick={() => handleDeleteAnnouncement(article)}
                            disabled={isLoading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Announcement Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmArticle} onOpenChange={(open) => !open && setDeleteConfirmArticle(null)}>
        <AlertDialogContent
          className={`border-2 rounded-2xl ${theme.mode === "dark" ? "bg-[#0f1419] border-white/10" : "bg-white border-gray-200"}`}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className={`text-xl font-bold ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
              Удалить уведомление?
            </AlertDialogTitle>
            <AlertDialogDescription className={`text-base ${theme.mode === "dark" ? "text-white/70" : "text-gray-600"}`}>
              Вы действительно хотите удалить уведомление{" "}
              <span className="font-semibold" style={{ color: getTieColor() }}>
                &ldquo;{deleteConfirmArticle?.title}&rdquo;
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
              onClick={confirmDeleteAnnouncement}
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
