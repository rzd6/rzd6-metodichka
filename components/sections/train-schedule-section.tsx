"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Plus, Trash2, UserX, Database, Train, CalendarClock } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"
import { getThemeColor } from "@/lib/theme-utils"
import type { UserRole } from "@/data/users"
import { canClaimShift, canDeleteOwnShift, canDeleteAnyShift, canManageTrainDB } from "@/data/users"
import { useToast } from "@/hooks/use-toast"

interface TrainRecord {
  id: string
  train_number: number
  direction: string
  class: string
  depart_start: string | null
  arrive_middle: string | null
  depart_middle: string | null
  arrive_end: string | null
  platform_start: number
  platform_middle: number
  platform_end: number
  created_at: string
}

interface TrainShift {
  id: string
  train_id: string
  train_number: number
  claimed_by_nickname: string
  claimed_by_role: string
  shift_date: string
  created_at: string
  direction?: string
  class?: string
  depart_start?: string | null
  arrive_middle?: string | null
  depart_middle?: string | null
  arrive_end?: string | null
  platform_start?: number
  platform_middle?: number
  platform_end?: number
}

interface TrainScheduleSectionProps {
  userRole: UserRole
  userNickname?: string
}

const TRAIN_CLASSES = ["Скоростной", "Пассажирский", "Пригородный", "Туристический"] as const
const CLASS_ABBR: Record<string, string> = {
  Скоростной: "скор",
  Пассажирский: "пасс",
  Пригородный: "приг",
  Туристический: "тур",
}
const DIRECTIONS = [
  { value: "mirny-privolzhsk", label: "Мирный → Невский → Приволжск" },
  { value: "privolzhsk-mirny", label: "Приволжск → Невский → Мирный" },
] as const

const STATIONS = ["Мирный", "Невский", "Приволжск"] as const
type Station = (typeof STATIONS)[number]

function addMinutes(time: string | null | undefined, mins: number): string {
  if (!time) return "—"
  const [h, m] = time.split(":").map(Number)
  const total = h * 60 + m + mins
  const hh = Math.floor(((total % 1440) + 1440) % 1440 / 60).toString().padStart(2, "0")
  const mm = (((total % 1440) + 1440) % 1440 % 60).toString().padStart(2, "0")
  return `${hh}:${mm}`
}

function getMoscowTime(): string {
  return new Date().toLocaleTimeString("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getMoscowDateISO(): string {
  // YYYY-MM-DD in Moscow timezone
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" })
}

function formatDateRu(iso: string): string {
  // iso = "YYYY-MM-DD"
  return new Date(iso + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function directionLabel(dir: string) {
  return dir === "mirny-privolzhsk" ? "Мирный — Приволжск" : "Приволжск — Мирный"
}

function getStationLabels(dir: string) {
  if (dir === "mirny-privolzhsk") return { start: "Мирный", middle: "Невский", end: "Приволжск" }
  return { start: "Приволжск", middle: "Невский", end: "Мирный" }
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  })
  return res.json()
}

/** Trains that stop at a given station — only trains that have a claimed shift (машинист) are shown */
function getTrainsForStation(trains: TrainRecord[], shifts: TrainShift[], station: Station) {
  return trains
    .map((train) => {
      const s = getStationLabels(train.direction)
      const shift = shifts.find((sh) => sh.train_number === train.train_number)

      // Skip trains with no claimed shift — they don't belong on the board
      if (!shift) return null

      let arrival: string | null = null
      let departure: string | null = null
      let platform: number = 1

      if (station === s.start) {
        // Starting station: only departure
        departure = train.depart_start
        platform = train.platform_start
      } else if (station === s.middle) {
        arrival = train.arrive_middle
        departure = train.depart_middle
        platform = train.platform_middle
      } else if (station === s.end) {
        arrival = train.arrive_end
        platform = train.platform_end
      } else {
        return null
      }

      return { train, shift, arrival, departure, platform }
    })
    .filter(Boolean) as Array<{
      train: TrainRecord
      shift: TrainShift
      arrival: string | null
      departure: string | null
      platform: number
    }>
}

export function TrainScheduleSection({ userRole, userNickname }: TrainScheduleSectionProps) {
  const { theme } = useTheme()
  const { toast } = useToast()

  const [trains, setTrains] = useState<TrainRecord[]>([])
  const [shifts, setShifts] = useState<TrainShift[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Schedule state
  const [activeStation, setActiveStation] = useState<Station>("Мирный")
  const [claimTrainNumber, setClaimTrainNumber] = useState("")
  const [shiftDate, setShiftDate] = useState(getMoscowDateISO())
  const [deleteShiftTarget, setDeleteShiftTarget] = useState<TrainShift | null>(null)

  // Moscow clock
  const [moscowTime, setMoscowTime] = useState(getMoscowTime())
  useEffect(() => {
    const id = setInterval(() => setMoscowTime(getMoscowTime()), 10_000)
    return () => clearInterval(id)
  }, [])

  // Train DB form (admin tab shown separately below the board)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showTrainForm, setShowTrainForm] = useState(false)
  const [trainForm, setTrainForm] = useState({
    train_number: "",
    direction: "mirny-privolzhsk",
    class: "Скоростной",
    depart_start: "",
    arrive_middle: "",
    depart_middle: "",
    arrive_end: "",
    platform_start: "1",
    platform_middle: "1",
    platform_end: "1",
  })
  const [deleteTrainTarget, setDeleteTrainTarget] = useState<TrainRecord | null>(null)

  const getTieColor = () => getThemeColor(theme.colorTheme)
  const isDark = theme.mode === "dark"

  const loadTrains = useCallback(async () => {
    const { data } = await apiFetch("/api/trains")
    if (Array.isArray(data)) setTrains(data)
  }, [])

  const loadShifts = useCallback(async () => {
    const { data } = await apiFetch(`/api/train-shifts?date=${shiftDate}&with_trains=1`)
    if (Array.isArray(data)) setShifts(data)
  }, [shiftDate])

  useEffect(() => { loadTrains() }, [loadTrains])
  useEffect(() => { loadShifts() }, [loadShifts])

  // ---- Shift actions ----
  const handleClaimShift = async () => {
    const num = parseInt(claimTrainNumber)
    if (!num) { toast({ title: "Введите номер рейса", variant: "destructive" }); return }
    const train = trains.find((t) => t.train_number === num)
    if (!train) {
      toast({ title: "Рейс не найден", description: `Рейс №${num} отсутствует в базе данных`, variant: "destructive" })
      return
    }
    const alreadyClaimed = shifts.find((s) => s.train_number === num)
    if (alreadyClaimed) {
      toast({ title: "Рейс занят", description: `Рейс №${num} уже занял ${alreadyClaimed.claimed_by_nickname}`, variant: "destructive" })
      return
    }
    setIsLoading(true)
    try {
      const { data, error } = await apiFetch("/api/train-shifts", {
        method: "POST",
        body: JSON.stringify({
          train_id: train.id,
          train_number: train.train_number,
          claimed_by_nickname: userNickname || "Неизвестный",
          claimed_by_role: userRole,
          shift_date: shiftDate,
        }),
      })
      if (error) throw new Error(error)
      if (data) {
        await loadShifts()
        setClaimTrainNumber("")
        toast({ title: "Рейс занят", description: `Рейс №${num} закреплён за вами` })
      }
    } catch (err: any) {
      toast({ title: "Ошибка", description: err?.message || "Не удалось занять рейс", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteShift = async () => {
    if (!deleteShiftTarget) return
    setIsLoading(true)
    const targetId = deleteShiftTarget.id
    // Optimistic: remove from local state immediately
    setShifts((prev) => prev.filter((s) => s.id !== targetId))
    setDeleteShiftTarget(null)
    try {
      const { error } = await apiFetch("/api/train-shifts", {
        method: "DELETE",
        body: JSON.stringify({ id: targetId }),
      })
      if (error) throw new Error(error)
      await loadShifts()
      toast({ title: "Рейс освобождён" })
    } catch (err: any) {
      // Revert optimistic update on failure
      await loadShifts()
      toast({ title: "Ошибка", description: err?.message || "Не удалось освободить рейс", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  // ---- Train DB actions ----
  const handleAddTrain = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const { data, error } = await apiFetch("/api/trains", {
        method: "POST",
        body: JSON.stringify({
          train_number: parseInt(trainForm.train_number),
          direction: trainForm.direction,
          class: trainForm.class,
          depart_start: trainForm.depart_start || null,
          arrive_middle: trainForm.arrive_middle || null,
          depart_middle: trainForm.depart_middle || null,
          arrive_end: trainForm.arrive_end || null,
          platform_start: parseInt(trainForm.platform_start) || 1,
          platform_middle: parseInt(trainForm.platform_middle) || 1,
          platform_end: parseInt(trainForm.platform_end) || 1,
        }),
      })
      if (error) throw new Error(error)
      if (!data) {
        toast({ title: "Рейс с таким номером уже существует", variant: "destructive" })
      } else {
        const addedNum = trainForm.train_number
        await loadTrains()
        setShowTrainForm(false)
        setTrainForm({
          train_number: "", direction: "mirny-privolzhsk", class: "Скоростной",
          depart_start: "", arrive_middle: "", depart_middle: "", arrive_end: "",
          platform_start: "1", platform_middle: "1", platform_end: "1",
        })
        toast({ title: "Рейс добавлен", description: `Рейс №${addedNum} добавлен в базу` })
      }
    } catch (err: any) {
      toast({ title: "Ошибка", description: err?.message || "Не удалось добавить рейс", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTrain = async () => {
    if (!deleteTrainTarget) return
    setIsLoading(true)
    try {
      const { error } = await apiFetch("/api/trains", {
        method: "DELETE",
        body: JSON.stringify({ id: deleteTrainTarget.id }),
      })
      if (error) throw new Error(error)
      await loadTrains()
      await loadShifts()
      toast({ title: "Рейс удалён из базы" })
      setDeleteTrainTarget(null)
    } catch (err: any) {
      toast({ title: "Ошибка", description: err?.message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const canRemoveShift = (shift: TrainShift) => {
    if (canDeleteAnyShift(userRole)) return true
    if (canDeleteOwnShift(userRole) && shift.claimed_by_nickname === userNickname) return true
    return false
  }

  const stationRows = getTrainsForStation(trains, shifts, activeStation)

  // ---- Colours matching the RZD board aesthetic ----
  const boardBg = "#1a1f2e"
  const headerBg = "#c0392b"
  const rowEvenBg = "#141820"
  const rowOddBg = "#1a1f2e"
  const borderClr = "#2a3040"

  return (
    <div className="space-y-6 opacity-95">
      {/* ===== STANDARD SECTION HEADER (matches lectures / duty style) ===== */}
      <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: getTieColor() + "40" }}>
        <div
          className="p-3 rounded-xl"
          style={{ background: `linear-gradient(135deg, ${getTieColor()}20, ${getTieColor()}10)` }}
        >
          <CalendarClock className="w-6 h-6" style={{ color: getTieColor() }} />
        </div>
        <div>
          <h2 className="text-3xl font-bold" style={{ color: getTieColor() }}>
            Расписание рейсов
          </h2>
          <p className={`text-sm ${isDark ? "text-white/70" : "text-gray-600"}`}>
            Движение поездов по станциям РЖД
          </p>
        </div>
      </div>

      {/* ===== BOARD ===== */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: boardBg, border: `1px solid ${borderClr}` }}
      >
        {/* Top bar: title + date + claim form */}
        <div className="px-5 py-3 flex flex-wrap items-center gap-4" style={{ borderBottom: `1px solid ${borderClr}` }}>
          <div className="flex items-center gap-2 mr-auto">
            <Train className="w-5 h-5 text-white/70" />
            <span className="text-white font-bold text-lg tracking-wide uppercase">
              РАСПИСАНИЕ ДВИЖЕНИЯ ПОЕЗДОВ НА {formatDateRu(shiftDate).toUpperCase()}
            </span>
          </div>

          {/* Date picker */}
          <Input
            type="date"
            value={shiftDate}
            onChange={(e) => setShiftDate(e.target.value)}
            className="h-8 w-40 text-sm bg-white/5 border-white/20 text-white [color-scheme:dark]"
          />

          {/* Manage DB button (Старший+ only) */}
          {canManageTrainDB(userRole) && (
            <button
              onClick={() => setShowAdminPanel((v) => !v)}
              className="flex items-center gap-1.5 h-8 px-3 rounded text-sm font-medium text-white/70 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
            >
              <Database className="w-4 h-4" />
              База рейсов
            </button>
          )}
        </div>

        {/* Station tabs */}
        <div className="flex gap-0" style={{ borderBottom: `1px solid ${borderClr}` }}>
          {STATIONS.map((st) => (
            <button
              key={st}
              onClick={() => setActiveStation(st)}
              className="flex-1 py-2.5 text-sm font-semibold tracking-wide transition-all"
              style={
                activeStation === st
                  ? { background: getTieColor(), color: "#fff" }
                  : { background: "#252b3b", color: "rgba(255,255,255,0.55)" }
              }
            >
              {st}
            </button>
          ))}
        </div>

        {/* Inner board header */}
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${borderClr}` }}>
          <div>
            <p className="text-white font-bold text-base">Прибытие и отправление поездов</p>
            <p className="text-white/50 text-xs mt-0.5">Станция {activeStation}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/50 text-xs text-right leading-tight">
              Московское<br />время
            </span>
            <div
              className="text-white font-bold text-xl px-3 py-1 rounded"
              style={{ background: "#252b3b", border: `1px solid ${borderClr}`, fontVariantNumeric: "tabular-nums" }}
            >
              {moscowTime}
            </div>
          </div>
        </div>

        {/* Column headers row */}
        <div
          className="grid text-white text-sm font-semibold px-5 py-2.5"
          style={{
            gridTemplateColumns: "64px 90px 1fr 100px 120px 56px 180px 48px",
            background: headerBg,
          }}
        >
          <span>Номер поезда</span>
          <span>Категория</span>
          <span>Назначение</span>
          <span>Прибытие</span>
          <span>Отправление</span>
          <span>Путь</span>
          <span>Машинист</span>
          <span />
        </div>

        {/* Rows */}
        {stationRows.length === 0 ? (
          <div className="py-10 text-center text-white/40 text-sm" style={{ background: boardBg }}>
            {trains.length === 0
              ? "База рейсов пуста. Обратитесь к Старшему Составу."
              : "На выбранную дату нет занятых рейсов через эту станцию."}
          </div>
        ) : (
          stationRows.map(({ train, shift, arrival, departure, platform }, idx) => {
            const stations = getStationLabels(train.direction)
            const rowBg = idx % 2 === 0 ? rowEvenBg : rowOddBg
            return (
              <div
                key={train.id}
                className="grid items-center px-5 py-3 text-sm"
                style={{
                  gridTemplateColumns: "64px 90px 1fr 100px 120px 56px 180px 48px",
                  background: rowBg,
                  borderBottom: `1px solid ${borderClr}`,
                }}
              >
                {/* Train number */}
                <span className="text-xl font-extrabold" style={{ color: "#f5c518" }}>
                  {train.train_number}
                </span>

                {/* Category */}
                <span className="font-bold text-white/90 uppercase text-xs tracking-wide">
                  {CLASS_ABBR[train.class] ?? train.class}
                </span>

                {/* Route */}
                <span className="font-semibold" style={{ color: "#f5c518" }}>
                  {stations.start} — {stations.end}
                </span>

                {/* Arrival */}
                <span className="font-bold text-white text-base" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {arrival ?? <span className="text-white/30 text-lg font-bold">—</span>}
                </span>

                {/* Departure */}
                <span className="font-bold text-white text-base" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {departure ?? <span className="text-white/30 text-lg font-bold">—</span>}
                </span>

                {/* Platform */}
                <span className="font-bold text-white/80 text-base">{platform}</span>

                {/* Claimed by — shift is always defined here (unclaimed trains are filtered out) */}
                <div>
                  <span className="text-white/90 text-sm font-medium">{shift.claimed_by_nickname}</span>
                </div>

                {/* Delete action */}
                <div className="flex justify-end">
                  {canRemoveShift(shift) && (
                    <button
                      onClick={() => setDeleteShiftTarget(shift)}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                      title="Освободить рейс"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}

        {/* Claim bar — always visible for eligible roles */}
        {canClaimShift(userRole) && (
          <div
            className="px-5 py-4 space-y-3"
            style={{ background: "#252b3b", borderTop: `1px solid ${borderClr}` }}
          >
            <p className="text-white/50 text-xs uppercase tracking-wide font-semibold">Занять рейс</p>

            {/* Available (unclaimed) trains list */}
            {(() => {
              const unclaimedTrains = trains.filter(
                (t) => !shifts.some((s) => s.train_number === t.train_number)
              )
              if (unclaimedTrains.length === 0) {
                return (
                  <p className="text-white/30 text-sm italic">
                    Нет доступных рейсов на {formatDateRu(shiftDate)} — все рейсы заняты или база пуста.
                  </p>
                )
              }
              return (
                <div className="flex flex-wrap gap-2">
                  {unclaimedTrains.map((t) => {
                    const s = getStationLabels(t.direction)
                    const isSelected = claimTrainNumber === String(t.train_number)
                    return (
                      <button
                        key={t.id}
                        onClick={() => setClaimTrainNumber(isSelected ? "" : String(t.train_number))}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                        style={
                          isSelected
                            ? { background: getTieColor(), borderColor: getTieColor(), color: "#fff" }
                            : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }
                        }
                      >
                        <span className="font-bold" style={{ color: isSelected ? "#fff" : "#f5c518" }}>
                          #{t.train_number}
                        </span>
                        <span className="text-xs opacity-70">
                          {s.start} — {s.end}
                        </span>
                        <span className="text-xs opacity-50 uppercase">
                          {CLASS_ABBR[t.class] ?? t.class}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })()}

            {/* Confirm button — shown when a train is selected */}
            {claimTrainNumber && (
              <div className="flex items-center gap-3">
                <span className="text-white/60 text-sm">
                  Занять рейс <span className="font-bold text-white">№{claimTrainNumber}</span>?
                </span>
                <Button
                  onClick={handleClaimShift}
                  disabled={isLoading}
                  size="sm"
                  className="h-8 text-white font-semibold"
                  style={{ background: getTieColor() }}
                >
                  Подтвердить
                </Button>
                <button
                  onClick={() => setClaimTrainNumber("")}
                  className="text-white/40 hover:text-white/70 text-sm"
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== ADMIN PANEL ===== */}
      {canManageTrainDB(userRole) && showAdminPanel && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: boardBg, border: `1px solid ${borderClr}` }}
        >
          {/* Header */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ background: headerBg }}
          >
            <span className="text-white font-bold text-sm uppercase tracking-wide">База рейсов</span>
            <button
              onClick={() => setShowTrainForm((v) => !v)}
              className="flex items-center gap-1.5 h-7 px-3 rounded text-xs font-semibold text-white bg-white/20 hover:bg-white/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Добавить
            </button>
          </div>

          {/* Add form */}
          {showTrainForm && (
            <form
              onSubmit={handleAddTrain}
              className="px-5 py-4 space-y-4"
              style={{ borderBottom: `1px solid ${borderClr}`, background: "#0f1419" }}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Номер рейса *</Label>
                  <Input
                    type="number" min={1} required
                    placeholder="1"
                    value={trainForm.train_number}
                    onChange={(e) => setTrainForm((f) => ({ ...f, train_number: e.target.value }))}
                    className="h-8 text-sm bg-white/5 border-white/10 text-white [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-white/60">Направление *</Label>
                  <Select value={trainForm.direction} onValueChange={(v) => setTrainForm((f) => ({ ...f, direction: v }))}>
                    <SelectTrigger className="h-8 text-sm bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIRECTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Класс *</Label>
                  <Select value={trainForm.class} onValueChange={(v) => setTrainForm((f) => ({ ...f, class: v }))}>
                    <SelectTrigger className="h-8 text-sm bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRAIN_CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(() => {
                const s = getStationLabels(trainForm.direction)
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { key: "depart_start", label: `Отпр. из ${s.start}` },
                      { key: "arrive_middle", label: `Приб. в ${s.middle}` },
                      { key: "depart_middle", label: `Отпр. из ${s.middle}` },
                      { key: "arrive_end", label: `Приб. в ${s.end}` },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs text-white/60">{label}</Label>
                        <Input
                          type="time"
                          value={trainForm[key as keyof typeof trainForm]}
                          onChange={(e) => setTrainForm((f) => ({ ...f, [key]: e.target.value }))}
                          className="h-8 text-sm bg-white/5 border-white/10 text-white [color-scheme:dark]"
                        />
                      </div>
                    ))}
                  </div>
                )
              })()}

              {(() => {
                const s = getStationLabels(trainForm.direction)
                return (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: "platform_start", label: `Путь (${s.start})` },
                      { key: "platform_middle", label: `Путь (${s.middle})` },
                      { key: "platform_end", label: `Путь (${s.end})` },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs text-white/60">{label}</Label>
                        <Input
                          type="number" min={1}
                          value={trainForm[key as keyof typeof trainForm]}
                          onChange={(e) => setTrainForm((f) => ({ ...f, [key]: e.target.value }))}
                          className="h-8 text-sm bg-white/5 border-white/10 text-white [color-scheme:dark]"
                        />
                      </div>
                    ))}
                  </div>
                )
              })()}

              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading} size="sm" className="text-white font-semibold h-8" style={{ background: getTieColor() }}>
                  Добавить рейс
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 bg-transparent border-white/20 text-white/70 hover:bg-white/10" onClick={() => setShowTrainForm(false)}>
                  Отмена
                </Button>
              </div>
            </form>
          )}

          {/* All trains — vertical card list */}
          {trains.length === 0 ? (
            <p className="text-center py-8 text-white/40 text-sm">База рейсов пуста</p>
          ) : (
            <div className="divide-y divide-[#2a3040]">
              {[...trains]
                .sort((a, b) => (a.depart_start || "99:99").localeCompare(b.depart_start || "99:99"))
                .map((train, idx) => {
                  const s = getStationLabels(train.direction)
                  const shift = shifts.find((sh) => sh.train_number === train.train_number)
                  const depoPlatform = train.direction === "mirny-privolzhsk" ? 1 : 2

                  // Depot departure = depart_start - 3 min (Mirny→Privolzhsk) or - 5 min (Privolzhsk→Mirny)
                  // Depot arrival = arrive_end + 4 min (Mirny→Privolzhsk) or + 2 min (Privolzhsk→Mirny)
                  const offsetDepartDepot = train.direction === "mirny-privolzhsk" ? -3 : -5
                  const offsetArriveDepot = train.direction === "mirny-privolzhsk" ? 4 : 2
                  const offsetArriveStart = -1 // arrives 1 min before depart_start
                  const offsetDepartEnd = 1   // departs 1 min after arrive_end

                  const depoDepart = addMinutes(train.depart_start, offsetDepartDepot)
                  const startArrive = addMinutes(train.depart_start, offsetArriveStart)
                  const endDepart = addMinutes(train.arrive_end, offsetDepartEnd)
                  const depoArrive = addMinutes(train.arrive_end, offsetArriveDepot)

                  const rowBg = idx % 2 === 0 ? rowEvenBg : rowOddBg

                  const timeCell = (label: string, val: string | null | undefined, highlight?: boolean) => (
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-white/35 uppercase tracking-wide leading-none mb-0.5">{label}</span>
                      <span
                        className="font-mono text-sm font-semibold leading-none"
                        style={{ color: highlight ? "#f5c518" : (val ? "#fff" : "rgba(255,255,255,0.25)") }}
                      >
                        {val || "—"}
                      </span>
                    </div>
                  )

                  return (
                    <div
                      key={train.id}
                      className="px-5 py-3"
                      style={{ background: rowBg }}
                    >
                      {/* Top: number + class + route + platform + delete */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xl font-extrabold w-9 flex-shrink-0" style={{ color: "#f5c518" }}>
                          {train.train_number}
                        </span>
                        <span className="text-xs font-bold uppercase text-white/50 tracking-wide w-14 flex-shrink-0">
                          {CLASS_ABBR[train.class] ?? train.class}
                        </span>
                        <span className="text-white/80 text-xs flex-1">
                          {s.start} — {s.end}
                        </span>
                        <span className="text-xs text-white/40 flex-shrink-0">Путь депо: <span className="text-white/70 font-semibold">{depoPlatform}</span></span>
                        {canManageTrainDB(userRole) && (
                          <button
                            onClick={() => setDeleteTrainTarget(train)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-red-500/50 hover:text-red-400 transition-colors flex-shrink-0"
                            title="Удалить рейс из базы"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {/* Bottom: time columns */}
                      <div className="flex items-start gap-4 flex-wrap">
                        {timeCell("Отпр. депо", depoDepart, true)}
                        {timeCell(`Приб. ${s.start}`, startArrive)}
                        {timeCell(`Отпр. ${s.start}`, train.depart_start)}
                        {timeCell(`Приб. Невский`, train.arrive_middle)}
                        {timeCell(`Отпр. Невский`, train.depart_middle)}
                        {timeCell(`Приб. ${s.end}`, train.arrive_end)}
                        {timeCell(`Отпр. ${s.end}`, endDepart)}
                        {timeCell("Приб. депо", depoArrive, true)}
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] text-white/35 uppercase tracking-wide leading-none mb-0.5">Машинист</span>
                          {shift ? (
                            <span className="text-green-400 text-xs font-semibold">{shift.claimed_by_nickname}</span>
                          ) : (
                            <span className="text-white/25 text-xs italic">Свободен</span>
                          )}
                        </div>
                        {shift && canRemoveShift(shift) && (
                          <div className="flex flex-col justify-end">
                            <button
                              onClick={() => setDeleteShiftTarget(shift)}
                              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10 transition-colors"
                            >
                              <UserX className="w-3 h-3" />
                              Снять
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* ===== CONFIRM DIALOGS ===== */}
      <AlertDialog open={!!deleteShiftTarget} onOpenChange={(o) => !o && setDeleteShiftTarget(null)}>
        <AlertDialogContent className="bg-[#1a1f2e] border border-[#2a3040] text-white rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить рейс?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Рейс №{deleteShiftTarget?.train_number} ({deleteShiftTarget?.claimed_by_nickname}) будет освобождён.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteShift} className="bg-red-600 hover:bg-red-700 text-white border-0">
              <UserX className="w-4 h-4 mr-2" /> Освободить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTrainTarget} onOpenChange={(o) => !o && setDeleteTrainTarget(null)}>
        <AlertDialogContent className="bg-[#1a1f2e] border border-[#2a3040] text-white rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить рейс из базы?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Рейс №{deleteTrainTarget?.train_number} ({directionLabel(deleteTrainTarget?.direction || "")}) будет удалён. Все записи на него также будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTrain} className="bg-red-600 hover:bg-red-700 text-white border-0">
              <Trash2 className="w-4 h-4 mr-2" /> Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
