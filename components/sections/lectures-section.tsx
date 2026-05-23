"use client"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { contentData } from "@/data/content"
import { Copy, Check, BookOpenText } from "lucide-react"
import { useState, useEffect } from "react"
import { useTheme } from "@/contexts/theme-context"
import { getThemeColor } from "@/lib/theme-utils"

export function LecturesSection() {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<"main" | "additional">("main")
  const { theme } = useTheme()

  useEffect(() => {
    setCopiedIndex(null)
  }, [selectedCategory])

  const getTieColor = () => getThemeColor(theme.colorTheme)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(id)
  }

  const renderContent = (content: string[], lectureId: string) => {
    // Find what index was last copied in this lecture
    const lastCopiedIndex =
      copiedIndex !== null && copiedIndex.startsWith(lectureId + "-")
        ? parseInt(copiedIndex.replace(lectureId + "-", ""), 10)
        : -1

    return content.map((line, index) => {
      const lineId = `${lectureId}-${index}`
      const isCopied = copiedIndex === lineId
      const isNext = lastCopiedIndex >= 0 && index === lastCopiedIndex + 1

      return (
        <button
          key={index}
          onClick={() => copyToClipboard(line, lineId)}
          className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 group mb-3 ${isCopied
              ? theme.mode === "dark"
                ? "bg-gradient-to-r from-green-900/40 to-green-900/20 border-green-500/60"
                : "bg-gradient-to-r from-green-50 to-green-50/60 border-green-400"
              : isNext
                ? theme.mode === "dark"
                  ? "bg-gradient-to-r from-[#0f1419]/80 to-[#0f1419]/60 border-white/40 shadow-md"
                  : "bg-gradient-to-r from-white to-gray-50/60 border-gray-400 shadow-md"
                : theme.mode === "dark"
                  ? "bg-gradient-to-r from-[#0f1419]/80 to-[#0f1419]/60 border-white/10 hover:border-white/30"
                  : "bg-gradient-to-r from-white/80 to-gray-50/60 border-gray-200 hover:border-gray-300"
            } ${isNext ? "animate-pulse-subtle" : ""}`}
          style={{
            borderLeftWidth: "4px",
            borderLeftColor: isCopied ? "#22c55e" : isNext ? getTieColor() : getTieColor(),
            opacity: isNext ? 1 : undefined,
            boxShadow: isNext ? `0 0 0 2px ${getTieColor()}40` : undefined,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <p
              className={`text-sm flex-1 ${isCopied
                  ? "text-green-500"
                  : isNext
                    ? theme.mode === "dark"
                      ? "text-white font-medium"
                      : "text-gray-900 font-medium"
                    : theme.mode === "dark"
                      ? "text-white/90"
                      : "text-gray-900"
                }`}
            >
              {line}
            </p>
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{
                backgroundColor: isCopied ? "#22c55e20" : getTieColor() + "20",
              }}
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy
                  className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{ color: getTieColor() }}
                />
              )}
            </div>
          </div>
        </button>
      )
    })
  }

  const lectures = selectedCategory === "main" ? contentData.lectures.main : contentData.lectures.additional

  return (
    <div className="space-y-6 opacity-95">
      <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: getTieColor() + "40" }}>
        <div
          className="p-3 rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${getTieColor()}20, ${getTieColor()}10)`,
          }}
        >
          <BookOpenText className="w-6 h-6" style={{ color: getTieColor() }} />
        </div>
        <div>
          <h2 className="text-3xl font-bold" style={{ color: getTieColor() }}>
            Лекции
          </h2>
          <p className={`text-sm ${theme.mode === "dark" ? "text-white/70" : "text-gray-600"}`}>
            Обучающие материалы для сотрудников РЖД
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setSelectedCategory("main")}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 border-2 ${selectedCategory === "main"
              ? "text-white shadow-lg"
              : theme.mode === "dark"
                ? "bg-[#0f1419]/50 border-white/10 text-white/70 hover:border-white/30"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          style={selectedCategory === "main" ? { backgroundColor: getTieColor(), borderColor: getTieColor() } : {}}
        >
          Основные лекции
        </button>
        <button
          onClick={() => setSelectedCategory("additional")}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 border-2 ${selectedCategory === "additional"
              ? "text-white shadow-lg"
              : theme.mode === "dark"
                ? "bg-[#0f1419]/50 border-white/10 text-white/70 hover:border-white/30"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          style={
            selectedCategory === "additional" ? { backgroundColor: getTieColor(), borderColor: getTieColor() } : {}
          }
        >
          Дополнительные лекции
        </button>
      </div>

      <Accordion type="single" collapsible className="space-y-4">
        {lectures.map((lecture) => (
          <AccordionItem
            key={lecture.id}
            value={lecture.id}
            className={`border-2 rounded-2xl overflow-hidden ${theme.mode === "dark" ? "bg-[#0f1419]/50 border-white/10" : "bg-white border-gray-200"}`}
          >
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <BookOpenText className="w-5 h-5" style={{ color: getTieColor() }} />
                <span className={`font-bold ${theme.mode === "dark" ? "text-white" : "text-gray-900"}`}>
                  {lecture.number}. {lecture.title}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">{renderContent(lecture.content, lecture.id)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
