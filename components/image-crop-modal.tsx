"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RotateCcw, Check, X } from "lucide-react"

interface ImageCropModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageSrc: string
  /** "avatar" = square/circle crop, "background" = 16:9 wide crop */
  mode: "avatar" | "background"
  onCrop: (dataUrl: string) => void
}

const CROP_SIZES = {
  avatar: { w: 280, h: 280 },
  background: { w: 560, h: 315 },
}

export function ImageCropModal({ open, onOpenChange, imageSrc, mode, onCrop }: ImageCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })
  const touchStart = useRef({ tx: 0, ty: 0, ox: 0, oy: 0 })
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 1, h: 1 })
  const [containerSize, setContainerSize] = useState({ w: 600, h: 340 })

  const cropW = CROP_SIZES[mode].w
  const cropH = CROP_SIZES[mode].h

  // Load image
  useEffect(() => {
    if (!imageSrc || !open) return
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      imgRef.current = img
      setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.src = imageSrc
  }, [imageSrc, open])

  // Measure container size via ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const e = entries[0]
      setContainerSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  // Center + fit image when image or container changes
  const resetTransform = useCallback(() => {
    const { w: iw, h: ih } = imgNaturalSize
    const { w: cw, h: ch } = containerSize
    if (!iw || !cw) return
    const fitScale = Math.max(cropW / iw, cropH / ih)
    const initScale = Math.max(fitScale, 0.5)
    const cropLeft = (cw - cropW) / 2
    const cropTop = (ch - cropH) / 2
    setScale(initScale)
    setOffset({
      x: cropLeft - (iw * initScale - cropW) / 2,
      y: cropTop - (ih * initScale - cropH) / 2,
    })
  }, [imgNaturalSize, containerSize, cropW, cropH])

  useEffect(() => { resetTransform() }, [resetTransform])

  // Draw canvas preview on every state change
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imgNaturalSize.w || !containerSize.w) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = containerSize.w * dpr
    canvas.height = containerSize.h * dpr
    canvas.style.width = containerSize.w + "px"
    canvas.style.height = containerSize.h + "px"
    ctx.scale(dpr, dpr)

    const { w: cw, h: ch } = containerSize
    const imgW = imgNaturalSize.w * scale
    const imgH = imgNaturalSize.h * scale
    const cropLeft = (cw - cropW) / 2
    const cropTop = (ch - cropH) / 2

    // Background
    ctx.clearRect(0, 0, cw, ch)

    // Draw full image (dimmed) as background context
    ctx.globalAlpha = 0.25
    ctx.drawImage(img, offset.x, offset.y, imgW, imgH)
    ctx.globalAlpha = 1

    // Clip to crop shape and draw bright image
    ctx.save()
    ctx.beginPath()
    if (mode === "avatar") {
      ctx.arc(cropLeft + cropW / 2, cropTop + cropH / 2, cropW / 2, 0, Math.PI * 2)
    } else {
      ctx.rect(cropLeft, cropTop, cropW, cropH)
    }
    ctx.clip()
    ctx.drawImage(img, offset.x, offset.y, imgW, imgH)
    ctx.restore()

    // Crop border
    ctx.strokeStyle = "rgba(255,255,255,0.95)"
    ctx.lineWidth = 2
    if (mode === "avatar") {
      ctx.beginPath()
      ctx.arc(cropLeft + cropW / 2, cropTop + cropH / 2, cropW / 2, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.strokeRect(cropLeft, cropTop, cropW, cropH)
      // Rule of thirds grid
      ctx.strokeStyle = "rgba(255,255,255,0.3)"
      ctx.lineWidth = 1
      for (let i = 1; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(cropLeft + (cropW / 3) * i, cropTop)
        ctx.lineTo(cropLeft + (cropW / 3) * i, cropTop + cropH)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cropLeft, cropTop + (cropH / 3) * i)
        ctx.lineTo(cropLeft + cropW, cropTop + (cropH / 3) * i)
        ctx.stroke()
      }
    }
  }, [offset, scale, imgNaturalSize, containerSize, cropW, cropH, mode])

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setOffset({
      x: dragStart.current.ox + e.clientX - dragStart.current.mx,
      y: dragStart.current.oy + e.clientY - dragStart.current.my,
    })
  }
  const onMouseUp = () => setDragging(false)

  // Touch drag
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { tx: t.clientX, ty: t.clientY, ox: offset.x, oy: offset.y }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    const t = e.touches[0]
    setOffset({
      x: touchStart.current.ox + t.clientX - touchStart.current.tx,
      y: touchStart.current.oy + t.clientY - touchStart.current.ty,
    })
  }

  // Wheel zoom (centered on mouse)
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((s) => Math.min(10, Math.max(0.2, s + delta)))
  }

  const zoom = (delta: number) => setScale((s) => Math.min(10, Math.max(0.2, s + delta)))

  // Export cropped image
  const handleConfirm = () => {
    const img = imgRef.current
    if (!img) return
    const out = document.createElement("canvas")
    out.width = cropW
    out.height = cropH
    const ctx = out.getContext("2d")
    if (!ctx) return
    const cropLeft = (containerSize.w - cropW) / 2
    const cropTop = (containerSize.h - cropH) / 2
    const srcX = (cropLeft - offset.x) / scale
    const srcY = (cropTop - offset.y) / scale
    const srcW = cropW / scale
    const srcH = cropH / scale
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, cropW, cropH)
    onCrop(out.toDataURL("image/png"))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl p-0 overflow-hidden flex flex-col max-h-[calc(100svh-2rem)]">
        <DialogHeader className="p-4 pb-2 flex-shrink-0">
          <DialogTitle>
            {mode === "avatar" ? "Обрезать аватар" : "Обрезать фон"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Перетаскивайте картинку, колёсиком или кнопками масштабируйте — выбранная область в рамке
          </p>
        </DialogHeader>

        {/* Canvas area — fills remaining space */}
        <div
          ref={containerRef}
          className="relative w-full bg-neutral-900 select-none flex-1 min-h-0"
          style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
          onWheel={onWheel}
        >
          <canvas
            ref={canvasRef}
            style={{ display: "block", pointerEvents: "none", width: "100%", height: "100%" }}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-t flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={() => zoom(-0.15)} title="Уменьшить">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="outline" size="icon" onClick={() => zoom(0.15)} title="Увеличить">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" title="Сбросить" onClick={resetTransform}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4 mr-1" />
              Отмена
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              <Check className="w-4 h-4 mr-1" />
              Применить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
