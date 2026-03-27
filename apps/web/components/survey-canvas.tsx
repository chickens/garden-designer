"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { Separator } from "@workspace/ui/components/separator"
import {
  Home,
  TreePine,
  Warehouse,
  Fence,
  Shrub,
  CircleDot,
  Droplets,
  Square,
  DoorOpen,
  Route,
  Trash2,
  Compass,
  RotateCcw,
  RotateCw,
  ImagePlus,
  ImageOff,
  Move,
} from "lucide-react"
import { useProject } from "@/lib/project-store"
import { useTheme } from "next-themes"
import type {
  SurveyElement,
  SurveyElementType,
  SurveyData,
  SurveyBackgroundImage,
} from "@/lib/types"
import { SURVEY_ELEMENT_LABELS } from "@/lib/types"

interface Transform {
  offsetX: number
  offsetY: number
  scale: number
}

type DragMode = "none" | "pan" | "move" | "resize" | "place" | "image-move" | "image-resize"

const ELEMENT_ICONS: Record<SurveyElementType, typeof Home> = {
  house: Home,
  tree: TreePine,
  shed: Warehouse,
  fence: Fence,
  hedge: Shrub,
  drain: CircleDot,
  tap: Droplets,
  manhole: Square,
  gate: DoorOpen,
  path: Route,
}

const ELEMENT_DEFAULTS: Record<SurveyElementType, { w: number; d: number }> = {
  house: { w: 400, d: 300 },
  tree: { w: 150, d: 150 },
  shed: { w: 200, d: 150 },
  fence: { w: 300, d: 10 },
  hedge: { w: 300, d: 40 },
  drain: { w: 30, d: 30 },
  tap: { w: 20, d: 20 },
  manhole: { w: 60, d: 60 },
  gate: { w: 100, d: 10 },
  path: { w: 100, d: 300 },
}

const ELEMENT_COLORS: Record<SurveyElementType, { fill: string; stroke: string }> = {
  house: { fill: "#78716c", stroke: "#57534e" },
  tree: { fill: "#4ade80", stroke: "#22c55e" },
  shed: { fill: "#a8a29e", stroke: "#78716c" },
  fence: { fill: "#92400e", stroke: "#78350f" },
  hedge: { fill: "#86efac", stroke: "#4ade80" },
  drain: { fill: "#64748b", stroke: "#475569" },
  tap: { fill: "#60a5fa", stroke: "#3b82f6" },
  manhole: { fill: "#6b7280", stroke: "#4b5563" },
  gate: { fill: "#d97706", stroke: "#b45309" },
  path: { fill: "#d6d3d1", stroke: "#a8a29e" },
}

const STRUCTURE_TYPES: SurveyElementType[] = ["house", "shed", "fence", "hedge", "gate", "path"]
const UTILITY_TYPES: SurveyElementType[] = ["drain", "tap", "manhole"]
const NATURE_TYPES: SurveyElementType[] = ["tree"]

export function SurveyCanvas() {
  const { project, updatePhaseData, importAsset, loadAssetUrl, hasDirHandle, save } =
    useProject()
  const { resolvedTheme } = useTheme()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const transformRef = React.useRef<Transform>({ offsetX: 0, offsetY: 0, scale: 1 })
  const rafRef = React.useRef<number>(0)

  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [placingType, setPlacingType] = React.useState<SurveyElementType | null>(null)
  const [adjustingImage, setAdjustingImage] = React.useState(false)
  const dragMode = React.useRef<DragMode>("none")
  const lastMouse = React.useRef({ x: 0, y: 0 })
  const resizeHandle = React.useRef<"se" | null>(null)

  const surveyData: SurveyData = project?.phases?.survey ?? { elements: [], compassAngle: 0 }
  const elements = surveyData.elements
  const compassAngle = surveyData.compassAngle
  const bgImage = surveyData.backgroundImage

  // Cache the loaded HTMLImageElement
  const imgRef = React.useRef<HTMLImageElement | null>(null)
  const imgPathRef = React.useRef<string | null>(null)
  const objectUrlRef = React.useRef<string | null>(null)

  // Load image from asset path
  React.useEffect(() => {
    if (!bgImage?.assetPath) {
      imgRef.current = null
      imgPathRef.current = null
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      return
    }
    if (imgPathRef.current === bgImage.assetPath) return

    let cancelled = false
    ;(async () => {
      const url = await loadAssetUrl(bgImage.assetPath)
      if (cancelled || !url) return

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = url

      const img = new Image()
      img.onload = () => {
        if (cancelled) return
        imgRef.current = img
        imgPathRef.current = bgImage.assetPath
        draw()
      }
      img.src = url
    })()

    return () => {
      cancelled = true
    }
  }, [bgImage?.assetPath, loadAssetUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup object URLs on unmount
  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  const setData = React.useCallback(
    (data: SurveyData) => {
      updatePhaseData("survey", data)
    },
    [updatePhaseData]
  )

  const setElements = React.useCallback(
    (newElements: SurveyElement[]) => {
      setData({ ...surveyData, elements: newElements })
    },
    [surveyData, setData]
  )

  const setBgImage = React.useCallback(
    (image: SurveyBackgroundImage | undefined) => {
      setData({ ...surveyData, backgroundImage: image })
    },
    [surveyData, setData]
  )

  const screenToGarden = React.useCallback((sx: number, sy: number) => {
    const t = transformRef.current
    return {
      x: (sx - t.offsetX) / t.scale,
      y: (sy - t.offsetY) / t.scale,
    }
  }, [])

  const hitTest = React.useCallback(
    (gx: number, gy: number): SurveyElement | null => {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i]!
        if (gx >= el.x && gx <= el.x + el.width && gy >= el.y && gy <= el.y + el.depth) {
          return el
        }
      }
      return null
    },
    [elements]
  )

  const hitResizeHandle = React.useCallback(
    (gx: number, gy: number): "se" | null => {
      if (!selectedId) return null
      const el = elements.find((e) => e.id === selectedId)
      if (!el) return null
      const handleSize = 12 / transformRef.current.scale
      const hx = el.x + el.width
      const hy = el.y + el.depth
      if (Math.abs(gx - hx) < handleSize && Math.abs(gy - hy) < handleSize) {
        return "se"
      }
      return null
    },
    [selectedId, elements]
  )

  const hitImageResizeHandle = React.useCallback(
    (gx: number, gy: number): boolean => {
      if (!adjustingImage || !bgImage) return false
      const handleSize = 12 / transformRef.current.scale
      const hx = bgImage.x + bgImage.width
      const hy = bgImage.y + bgImage.height
      return Math.abs(gx - hx) < handleSize && Math.abs(gy - hy) < handleSize
    },
    [adjustingImage, bgImage]
  )

  const hitImageBody = React.useCallback(
    (gx: number, gy: number): boolean => {
      if (!adjustingImage || !bgImage) return false
      return (
        gx >= bgImage.x &&
        gx <= bgImage.x + bgImage.width &&
        gy >= bgImage.y &&
        gy <= bgImage.y + bgImage.height
      )
    },
    [adjustingImage, bgImage]
  )

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !project) return

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.scale(dpr, dpr)

    const isDark = resolvedTheme === "dark"
    const { offsetX, offsetY, scale } = transformRef.current
    const { width: gardenW, depth: gardenD } = project.dimensions

    const toScreenX = (cx: number) => offsetX + cx * scale
    const toScreenY = (cy: number) => offsetY + cy * scale

    // Background
    ctx.fillStyle = isDark ? "#0a0a0a" : "#fafafa"
    ctx.fillRect(0, 0, rect.width, rect.height)

    // Garden fill
    ctx.fillStyle = isDark ? "#1a1f14" : "#f0f5e8"
    ctx.fillRect(toScreenX(0), toScreenY(0), gardenW * scale, gardenD * scale)

    // Background image (drawn behind grid and elements)
    if (bgImage && imgRef.current) {
      ctx.save()
      ctx.globalAlpha = bgImage.opacity
      ctx.drawImage(
        imgRef.current,
        toScreenX(bgImage.x),
        toScreenY(bgImage.y),
        bgImage.width * scale,
        bgImage.height * scale
      )
      ctx.restore()

      // Image adjustment border and handle
      if (adjustingImage) {
        const ix = toScreenX(bgImage.x)
        const iy = toScreenY(bgImage.y)
        const iw = bgImage.width * scale
        const ih = bgImage.height * scale

        ctx.setLineDash([6, 4])
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 2
        ctx.strokeRect(ix, iy, iw, ih)
        ctx.setLineDash([])

        // SE resize handle
        const hx = ix + iw
        const hy = iy + ih
        ctx.fillStyle = "#3b82f6"
        ctx.fillRect(hx - 6, hy - 6, 12, 12)
        ctx.fillStyle = "#fff"
        ctx.fillRect(hx - 4, hy - 4, 8, 8)
      }
    }

    // Grid lines (1m major only)
    const majorSpacing = 100
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
    ctx.lineWidth = 0.5
    for (let x = 0; x <= gardenW; x += majorSpacing) {
      const sx = Math.round(toScreenX(x)) + 0.5
      if (sx < -1 || sx > rect.width + 1) continue
      ctx.beginPath()
      ctx.moveTo(sx, toScreenY(0))
      ctx.lineTo(sx, toScreenY(gardenD))
      ctx.stroke()
    }
    for (let y = 0; y <= gardenD; y += majorSpacing) {
      const sy = Math.round(toScreenY(y)) + 0.5
      if (sy < -1 || sy > rect.height + 1) continue
      ctx.beginPath()
      ctx.moveTo(toScreenX(0), sy)
      ctx.lineTo(toScreenX(gardenW), sy)
      ctx.stroke()
    }

    // Garden border
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"
    ctx.lineWidth = 2
    ctx.strokeRect(toScreenX(0), toScreenY(0), gardenW * scale, gardenD * scale)

    // Dimension labels
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"
    ctx.font = "11px system-ui, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.fillText(
      `${(gardenW / 100).toFixed(1)} m`,
      toScreenX(gardenW / 2),
      toScreenY(0) - 8
    )
    ctx.save()
    ctx.translate(toScreenX(0) - 8, toScreenY(gardenD / 2))
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(`${(gardenD / 100).toFixed(1)} m`, 0, 0)
    ctx.restore()

    // Meter markers
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"
    ctx.font = "9px system-ui, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    for (let x = majorSpacing; x < gardenW; x += majorSpacing) {
      const sx = toScreenX(x)
      if (sx > 0 && sx < rect.width) {
        ctx.fillText(`${x / 100}`, sx, toScreenY(gardenD) + 4)
      }
    }
    ctx.textAlign = "right"
    ctx.textBaseline = "middle"
    for (let y = majorSpacing; y < gardenD; y += majorSpacing) {
      const sy = toScreenY(y)
      if (sy > 0 && sy < rect.height) {
        ctx.fillText(`${y / 100}`, toScreenX(0) - 4, sy)
      }
    }

    // Draw survey elements
    for (const el of elements) {
      const sx = toScreenX(el.x)
      const sy = toScreenY(el.y)
      const sw = el.width * scale
      const sd = el.depth * scale

      const colors = ELEMENT_COLORS[el.type]
      const isSelected = el.id === selectedId

      if (el.type === "tree") {
        const cx = sx + sw / 2
        const cy = sy + sd / 2
        const r = Math.min(sw, sd) / 2

        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fillStyle = colors.fill + "60"
        ctx.fill()
        ctx.strokeStyle = isSelected ? (isDark ? "#fff" : "#000") : colors.stroke
        ctx.lineWidth = isSelected ? 2.5 : 1.5
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2)
        ctx.fillStyle = "#92400e"
        ctx.fill()
      } else {
        ctx.fillStyle = colors.fill + "50"
        ctx.fillRect(sx, sy, sw, sd)
        ctx.strokeStyle = isSelected ? (isDark ? "#fff" : "#000") : colors.stroke
        ctx.lineWidth = isSelected ? 2.5 : 1.5
        ctx.strokeRect(sx, sy, sw, sd)

        if (el.type === "house") {
          ctx.save()
          ctx.beginPath()
          ctx.rect(sx, sy, sw, sd)
          ctx.clip()
          ctx.strokeStyle = colors.stroke + "40"
          ctx.lineWidth = 1
          const step = 12
          for (let i = -Math.max(sw, sd); i < Math.max(sw, sd) * 2; i += step) {
            ctx.beginPath()
            ctx.moveTo(sx + i, sy)
            ctx.lineTo(sx + i + Math.max(sw, sd), sy + Math.max(sw, sd))
            ctx.stroke()
          }
          ctx.restore()
        }
      }

      if (isSelected) {
        if (el.type !== "tree") {
          ctx.setLineDash([4, 3])
          ctx.strokeStyle = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)"
          ctx.lineWidth = 1
          ctx.strokeRect(sx - 2, sy - 2, sw + 4, sd + 4)
          ctx.setLineDash([])
        }

        const hx = sx + sw
        const hy = sy + sd
        ctx.fillStyle = isDark ? "#fff" : "#000"
        ctx.fillRect(hx - 5, hy - 5, 10, 10)
        ctx.fillStyle = colors.stroke
        ctx.fillRect(hx - 4, hy - 4, 8, 8)
      }

      const label = el.label || SURVEY_ELEMENT_LABELS[el.type]
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)"
      const fontSize = Math.max(9, Math.min(12, sw / 5))
      ctx.font = `${fontSize}px system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(label, sx + sw / 2, sy + sd / 2, sw - 4)
    }

    // Compass rose
    const compassX = toScreenX(gardenW) + 40
    const compassY = toScreenY(0) + 40
    const compassR = 24

    ctx.save()
    ctx.translate(compassX, compassY)
    ctx.rotate((-compassAngle * Math.PI) / 180)

    ctx.beginPath()
    ctx.arc(0, 0, compassR, 0, Math.PI * 2)
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"
    ctx.fill()
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, -compassR + 4)
    ctx.lineTo(-5, 0)
    ctx.lineTo(5, 0)
    ctx.closePath()
    ctx.fillStyle = "#ef4444"
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(0, compassR - 4)
    ctx.lineTo(-5, 0)
    ctx.lineTo(5, 0)
    ctx.closePath()
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"
    ctx.fill()

    ctx.fillStyle = "#ef4444"
    ctx.font = "bold 10px system-ui, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("N", 0, -compassR - 8)

    ctx.restore()
  }, [project, elements, selectedId, compassAngle, bgImage, adjustingImage, resolvedTheme])

  // Center garden on mount
  React.useEffect(() => {
    const container = containerRef.current
    if (!container || !project) return

    const rect = container.getBoundingClientRect()
    const { width: gardenW, depth: gardenD } = project.dimensions
    const padding = 80
    const scaleX = (rect.width - padding * 2) / gardenW
    const scaleY = (rect.height - padding * 2) / gardenD
    const scale = Math.min(scaleX, scaleY)

    transformRef.current = {
      scale,
      offsetX: (rect.width - gardenW * scale) / 2,
      offsetY: (rect.height - gardenD * scale) / 2,
    }

    draw()
  }, [project, draw])

  // Resize observer
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => draw())
    observer.observe(container)
    return () => observer.disconnect()
  }, [draw])

  // Wheel zoom
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const t = transformRef.current
      const rect = canvas!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newScale = Math.max(0.05, Math.min(50, t.scale * zoomFactor))

      t.offsetX = mx - (mx - t.offsetX) * (newScale / t.scale)
      t.offsetY = my - (my - t.offsetY) * (newScale / t.scale)
      t.scale = newScale

      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    }

    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [draw])

  // Pointer handlers
  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const g = screenToGarden(sx, sy)

    lastMouse.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    // Placing mode
    if (placingType) {
      const defaults = ELEMENT_DEFAULTS[placingType]
      const newEl: SurveyElement = {
        id: crypto.randomUUID(),
        type: placingType,
        x: g.x - defaults.w / 2,
        y: g.y - defaults.d / 2,
        width: defaults.w,
        depth: defaults.d,
        label: "",
      }
      setElements([...elements, newEl])
      setSelectedId(newEl.id)
      setPlacingType(null)
      dragMode.current = "none"
      return
    }

    // Image adjust mode — check image handles first
    if (adjustingImage && bgImage) {
      if (hitImageResizeHandle(g.x, g.y)) {
        dragMode.current = "image-resize"
        return
      }
      if (hitImageBody(g.x, g.y)) {
        dragMode.current = "image-move"
        return
      }
    }

    // Element resize handle
    const handle = hitResizeHandle(g.x, g.y)
    if (handle) {
      dragMode.current = "resize"
      resizeHandle.current = handle
      return
    }

    // Element hit
    const hit = hitTest(g.x, g.y)
    if (hit) {
      setSelectedId(hit.id)
      dragMode.current = "move"
      return
    }

    setSelectedId(null)
    dragMode.current = "pan"
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragMode.current === "none") return

    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }

    if (dragMode.current === "pan") {
      transformRef.current.offsetX += dx
      transformRef.current.offsetY += dy
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    if (dragMode.current === "image-move" && bgImage) {
      const scale = transformRef.current.scale
      setBgImage({
        ...bgImage,
        x: bgImage.x + dx / scale,
        y: bgImage.y + dy / scale,
      })
      return
    }

    if (dragMode.current === "image-resize" && bgImage) {
      const scale = transformRef.current.scale
      const newW = Math.max(50, bgImage.width + dx / scale)
      // Maintain aspect ratio
      const aspect = bgImage.height / bgImage.width
      setBgImage({
        ...bgImage,
        width: newW,
        height: newW * aspect,
      })
      return
    }

    if (dragMode.current === "move" && selectedId) {
      const scale = transformRef.current.scale
      setElements(
        elements.map((el) =>
          el.id === selectedId
            ? { ...el, x: el.x + dx / scale, y: el.y + dy / scale }
            : el
        )
      )
      return
    }

    if (dragMode.current === "resize" && selectedId) {
      const scale = transformRef.current.scale
      setElements(
        elements.map((el) => {
          if (el.id !== selectedId) return el
          return {
            ...el,
            width: Math.max(20, el.width + dx / scale),
            depth: Math.max(20, el.depth + dy / scale),
          }
        })
      )
    }
  }

  function onPointerUp() {
    dragMode.current = "none"
    resizeHandle.current = null
  }

  // Keyboard: delete / escape
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPlacingType(null)
        setSelectedId(null)
        setAdjustingImage(false)
        return
      }
      if (!selectedId) return
      if (e.key === "Delete" || e.key === "Backspace") {
        const target = e.target as HTMLElement
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
        e.preventDefault()
        setElements(elements.filter((el) => el.id !== selectedId))
        setSelectedId(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedId, elements, setElements])

  // --- Toolbar actions ---
  const selected = elements.find((el) => el.id === selectedId)

  const deleteSelected = React.useCallback(() => {
    if (!selectedId) return
    setElements(elements.filter((el) => el.id !== selectedId))
    setSelectedId(null)
  }, [selectedId, elements, setElements])

  const rotateCompass = React.useCallback(
    (delta: number) => {
      setData({ ...surveyData, compassAngle: (compassAngle + delta + 360) % 360 })
    },
    [surveyData, compassAngle, setData]
  )

  const importImage = React.useCallback(async () => {
    if (!hasDirHandle) {
      // Project not saved to a directory yet — prompt save first
      await save()
    }

    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || !project) return

      const ext = file.name.split(".").pop() || "jpg"
      const filename = `satellite-${Date.now()}.${ext}`
      const assetPath = await importAsset(file, filename)

      if (assetPath) {
        const objectUrl = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
          const { width: gw, depth: gd } = project.dimensions
          const aspect = img.naturalHeight / img.naturalWidth
          const fitW = gw
          const fitH = fitW * aspect
          setBgImage({
            assetPath,
            x: 0,
            y: (gd - fitH) / 2,
            width: fitW,
            height: fitH,
            opacity: 0.4,
          })
          setAdjustingImage(true)
          URL.revokeObjectURL(objectUrl)
        }
        img.src = objectUrl
      }
    }

    input.click()
  }, [project, hasDirHandle, save, importAsset, setBgImage])

  const removeImage = React.useCallback(() => {
    setBgImage(undefined)
    setAdjustingImage(false)
  }, [setBgImage])

  const cursorClass = placingType
    ? "cursor-crosshair"
    : adjustingImage
      ? "cursor-move"
      : "cursor-grab active:cursor-grabbing"

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className={`h-full w-full ${cursorClass}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {/* Survey toolbar */}
      <div className="bg-background/80 border-border/50 fixed left-3 top-16 z-50 flex flex-col items-center gap-1 rounded-lg border p-1 shadow-lg backdrop-blur-xl">
        {/* Image import */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={importImage}>
              <ImagePlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Import Satellite Image</TooltipContent>
        </Tooltip>

        {bgImage && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={adjustingImage ? "default" : "ghost"}
                  size="icon-sm"
                  onClick={() => setAdjustingImage(!adjustingImage)}
                >
                  <Move className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Adjust Image</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={removeImage}>
                  <ImageOff className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Remove Image</TooltipContent>
            </Tooltip>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={bgImage.opacity}
              onChange={(e) =>
                setBgImage({ ...bgImage, opacity: parseFloat(e.target.value) })
              }
              className="h-16 w-5"
              style={{ writingMode: "vertical-lr", direction: "rtl" }}
              title={`Opacity: ${Math.round(bgImage.opacity * 100)}%`}
            />
          </>
        )}

        <Separator className="w-5" />

        {/* Structures */}
        {STRUCTURE_TYPES.map((type) => {
          const Icon = ELEMENT_ICONS[type]
          return (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <Button
                  variant={placingType === type ? "default" : "ghost"}
                  size="icon-sm"
                  onClick={() => setPlacingType(placingType === type ? null : type)}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {SURVEY_ELEMENT_LABELS[type]}
              </TooltipContent>
            </Tooltip>
          )
        })}

        <Separator className="w-5" />

        {/* Nature */}
        {NATURE_TYPES.map((type) => {
          const Icon = ELEMENT_ICONS[type]
          return (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <Button
                  variant={placingType === type ? "default" : "ghost"}
                  size="icon-sm"
                  onClick={() => setPlacingType(placingType === type ? null : type)}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {SURVEY_ELEMENT_LABELS[type]}
              </TooltipContent>
            </Tooltip>
          )
        })}

        <Separator className="w-5" />

        {/* Utilities */}
        {UTILITY_TYPES.map((type) => {
          const Icon = ELEMENT_ICONS[type]
          return (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <Button
                  variant={placingType === type ? "default" : "ghost"}
                  size="icon-sm"
                  onClick={() => setPlacingType(placingType === type ? null : type)}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {SURVEY_ELEMENT_LABELS[type]}
              </TooltipContent>
            </Tooltip>
          )
        })}

        <Separator className="w-5" />

        {/* Compass controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => rotateCompass(-15)}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Rotate North -15°</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-7 w-7 items-center justify-center">
              <Compass className="text-muted-foreground h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">North: {compassAngle}°</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => rotateCompass(15)}>
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Rotate North +15°</TooltipContent>
        </Tooltip>

        {/* Selection tools */}
        {selected && (
          <>
            <Separator className="w-5" />
            <input
              type="text"
              value={selected.label}
              onChange={(e) =>
                setElements(
                  elements.map((el) =>
                    el.id === selectedId ? { ...el, label: e.target.value } : el
                  )
                )
              }
              className="bg-transparent text-foreground focus:ring-ring w-20 rounded px-1 py-0.5 text-center text-xs outline-none focus:ring-1"
              placeholder={SURVEY_ELEMENT_LABELS[selected.type]}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={deleteSelected}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Delete</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  )
}
