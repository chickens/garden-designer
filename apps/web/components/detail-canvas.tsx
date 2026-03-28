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
  Grid3x3,
  Rows3,
  Sprout,
  BoxSelect,
  Route,
  RectangleHorizontal,
  Waves,
  Columns3,
  Trash2,
  MousePointer2,
  Hand,
} from "lucide-react"
import { useProject } from "@/lib/project-store"
import { useOverlays } from "./overlay-controls"
import { drawPhaseOverlay } from "@/lib/draw-overlays"
import { useCanvasCamera } from "@/lib/use-canvas-camera"
import { copyToClipboard, pasteFromClipboard, offsetItem } from "@/lib/clipboard"
import { useTheme } from "next-themes"
import type { GardenItem, DetailItemType } from "@/lib/types"
import {
  DETAIL_ITEM_LABELS,
  DETAIL_ITEM_DEFAULTS,
  DETAIL_ITEM_COLORS,
} from "@/lib/types"

interface Transform {
  offsetX: number
  offsetY: number
  scale: number
}

type DragMode = "none" | "pan" | "move" | "resize" | "marquee"

interface MarqueeRect {
  x1: number; y1: number; x2: number; y2: number // garden coords
}

const DETAIL_ICONS: Record<DetailItemType, typeof Grid3x3> = {
  patio: Grid3x3,
  decking: Rows3,
  lawn: Sprout,
  "raised-bed": BoxSelect,
  path: Route,
  wall: RectangleHorizontal,
  pond: Waves,
  pergola: Columns3,
}

const SURFACE_TYPES: DetailItemType[] = ["patio", "decking", "lawn"]
const STRUCTURE_TYPES: DetailItemType[] = ["raised-bed", "path", "wall", "pergola"]
const WATER_TYPES: DetailItemType[] = ["pond"]

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

export function DetailCanvas() {
  const { project, updatePhaseData, setCamera } = useProject()
  const { resolvedTheme } = useTheme()
  const overlays = useOverlays()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const transformRef = React.useRef<Transform>({ offsetX: 0, offsetY: 0, scale: 1 })
  const rafRef = React.useRef<number>(0)

  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [placingType, setPlacingType] = React.useState<DetailItemType | null>(null)
  const [handMode, setHandMode] = React.useState(false)
  const [isPanning, setIsPanning] = React.useState(false)
  const dragMode = React.useRef<DragMode>("none")
  const lastMouse = React.useRef({ x: 0, y: 0 })
  const resizeHandle = React.useRef<"se" | null>(null)
  const marqueeRef = React.useRef<MarqueeRect | null>(null)

  const selectedId = selectedIds[selectedIds.length - 1] ?? null

  const items: GardenItem[] = project?.phases?.detailed?.items ?? []
  const gridSize = project?.gridSize ?? 5

  const setItems = React.useCallback(
    (newItems: GardenItem[]) => {
      updatePhaseData("detailed", { items: newItems })
    },
    [updatePhaseData]
  )

  const screenToGarden = React.useCallback((sx: number, sy: number) => {
    const t = transformRef.current
    return {
      x: (sx - t.offsetX) / t.scale,
      y: (sy - t.offsetY) / t.scale,
    }
  }, [])

  const hitTest = React.useCallback(
    (gx: number, gy: number): GardenItem | null => {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]!
        if (gx >= it.x && gx <= it.x + it.width && gy >= it.y && gy <= it.y + it.depth) {
          return it
        }
      }
      return null
    },
    [items]
  )

  const hitResizeHandle = React.useCallback(
    (gx: number, gy: number): "se" | null => {
      if (!selectedId) return null
      const it = items.find((i) => i.id === selectedId)
      if (!it) return null
      const handleSize = 12 / transformRef.current.scale
      const hx = it.x + it.width
      const hy = it.y + it.depth
      if (Math.abs(gx - hx) < handleSize && Math.abs(gy - hy) < handleSize) {
        return "se"
      }
      return null
    },
    [selectedId, items]
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

    // Adaptive grid
    const minorSpacing = project.gridSize
    const majorSpacing = 100
    const minPixelGap = 8
    const showMinor = minorSpacing * scale >= minPixelGap

    function drawGridLines(spacing: number, color: string, lineWidth: number) {
      ctx!.strokeStyle = color
      ctx!.lineWidth = lineWidth
      for (let x = 0; x <= gardenW; x += spacing) {
        const sx = Math.round(toScreenX(x)) + 0.5
        if (sx < -1 || sx > rect.width + 1) continue
        ctx!.beginPath()
        ctx!.moveTo(sx, toScreenY(0))
        ctx!.lineTo(sx, toScreenY(gardenD))
        ctx!.stroke()
      }
      for (let y = 0; y <= gardenD; y += spacing) {
        const sy = Math.round(toScreenY(y)) + 0.5
        if (sy < -1 || sy > rect.height + 1) continue
        ctx!.beginPath()
        ctx!.moveTo(toScreenX(0), sy)
        ctx!.lineTo(toScreenX(gardenW), sy)
        ctx!.stroke()
      }
    }

    if (showMinor) {
      drawGridLines(
        minorSpacing,
        isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        0.5
      )
    }
    drawGridLines(
      majorSpacing,
      isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
      1
    )

    // Phase overlays
    if (project) {
      const dc = { ctx, toScreenX, toScreenY, scale, isDark }
      for (const phase of overlays) {
        drawPhaseOverlay(dc, project, phase, "detailed")
      }
    }

    // --- Draw items ---
    for (const item of items) {
      const sx = toScreenX(item.x)
      const sy = toScreenY(item.y)
      const sw = item.width * scale
      const sd = item.depth * scale
      const isSelected = selectedIds.includes(item.id)
      const colors = DETAIL_ITEM_COLORS[item.type as DetailItemType] ?? {
        fill: "#9ca3af",
        stroke: "#6b7280",
      }

      // Fill
      ctx.fillStyle = colors.fill + "80"
      ctx.fillRect(sx, sy, sw, sd)

      // Type-specific patterns
      ctx.save()
      ctx.beginPath()
      ctx.rect(sx, sy, sw, sd)
      ctx.clip()

      const itemType = item.type as DetailItemType

      if (itemType === "patio") {
        // Diagonal hatch
        ctx.strokeStyle = colors.stroke + "30"
        ctx.lineWidth = 1
        const step = 10
        for (let i = -Math.max(sw, sd); i < Math.max(sw, sd) * 2; i += step) {
          ctx.beginPath()
          ctx.moveTo(sx + i, sy)
          ctx.lineTo(sx + i + Math.max(sw, sd), sy + Math.max(sw, sd))
          ctx.stroke()
        }
      } else if (itemType === "decking") {
        // Horizontal lines (planks)
        ctx.strokeStyle = colors.stroke + "40"
        ctx.lineWidth = 1
        const step = 8
        for (let y = 0; y < sd; y += step) {
          ctx.beginPath()
          ctx.moveTo(sx, sy + y)
          ctx.lineTo(sx + sw, sy + y)
          ctx.stroke()
        }
      } else if (itemType === "pond") {
        // Wavy lines
        ctx.strokeStyle = colors.stroke + "30"
        ctx.lineWidth = 1
        const step = 12
        for (let y = step; y < sd; y += step) {
          ctx.beginPath()
          for (let x = 0; x <= sw; x += 4) {
            const wy = sy + y + Math.sin((x / sw) * Math.PI * 4) * 3
            if (x === 0) ctx.moveTo(sx + x, wy)
            else ctx.lineTo(sx + x, wy)
          }
          ctx.stroke()
        }
      } else if (itemType === "pergola") {
        // Cross-hatch
        ctx.strokeStyle = colors.stroke + "25"
        ctx.lineWidth = 1
        const step = 14
        for (let i = 0; i < Math.max(sw, sd) * 2; i += step) {
          ctx.beginPath()
          ctx.moveTo(sx + i, sy)
          ctx.lineTo(sx + i - sd, sy + sd)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(sx + sw - i, sy)
          ctx.lineTo(sx + sw - i + sd, sy + sd)
          ctx.stroke()
        }
      }

      ctx.restore()

      // Stroke
      ctx.strokeStyle = isSelected ? (isDark ? "#fff" : "#000") : colors.stroke
      ctx.lineWidth = isSelected ? 2.5 : 1.5
      ctx.strokeRect(sx, sy, sw, sd)

      // Selection UI
      if (isSelected) {
        ctx.setLineDash([4, 3])
        ctx.strokeStyle = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)"
        ctx.lineWidth = 1
        ctx.strokeRect(sx - 2, sy - 2, sw + 4, sd + 4)
        ctx.setLineDash([])

        // SE resize handle
        const hx = sx + sw
        const hy = sy + sd
        ctx.fillStyle = isDark ? "#fff" : "#000"
        ctx.fillRect(hx - 5, hy - 5, 10, 10)
        ctx.fillStyle = colors.stroke
        ctx.fillRect(hx - 4, hy - 4, 8, 8)

        // Dimension label
        ctx.fillStyle = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)"
        ctx.font = "10px system-ui, sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillText(
          `${(item.width / 100).toFixed(2)} × ${(item.depth / 100).toFixed(2)} m`,
          sx + sw / 2,
          sy + sd + 6
        )
      }

      // Label
      const label =
        (item.metadata?.label as string) ||
        DETAIL_ITEM_LABELS[item.type as DetailItemType] ||
        item.type
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)"
      const fontSize = Math.max(9, Math.min(12, sw / 5))
      ctx.font = `${fontSize}px system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(label, sx + sw / 2, sy + sd / 2, sw - 4)
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
    // Marquee selection rectangle
    const mq = marqueeRef.current
    if (mq) {
      const mx = toScreenX(Math.min(mq.x1, mq.x2))
      const my = toScreenY(Math.min(mq.y1, mq.y2))
      const mw = Math.abs(mq.x2 - mq.x1) * scale
      const mh = Math.abs(mq.y2 - mq.y1) * scale
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = isDark ? "rgba(96,165,250,0.8)" : "rgba(59,130,246,0.8)"
      ctx.lineWidth = 1
      ctx.strokeRect(mx, my, mw, mh)
      ctx.fillStyle = isDark ? "rgba(96,165,250,0.1)" : "rgba(59,130,246,0.08)"
      ctx.fillRect(mx, my, mw, mh)
      ctx.setLineDash([])
    }
  }, [project, items, selectedIds, overlays, resolvedTheme])

  const { saveCamera } = useCanvasCamera(containerRef, transformRef, project, setCamera, draw)

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
      saveCamera()
    }
    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [draw, saveCamera])

  // Pointer handlers
  function onPointerDown(e: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const g = screenToGarden(sx, sy)
    lastMouse.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    // Middle-click always pans
    if (e.button === 1) {
      dragMode.current = "pan"
      setIsPanning(true)
      return
    }
    if (e.button !== 0) return

    // Hand mode — left-click pans
    if (handMode) {
      dragMode.current = "pan"
      return
    }

    // Placing
    if (placingType) {
      const defaults = DETAIL_ITEM_DEFAULTS[placingType]
      const snappedX = snapToGrid(g.x - defaults.w / 2, gridSize)
      const snappedY = snapToGrid(g.y - defaults.d / 2, gridSize)
      const newItem: GardenItem = {
        id: crypto.randomUUID(),
        type: placingType,
        x: snappedX,
        y: snappedY,
        width: defaults.w,
        depth: defaults.d,
        rotation: 0,
      }
      setItems([...items, newItem])
      setSelectedIds([newItem.id])
      setPlacingType(null)
      dragMode.current = "none"
      return
    }

    // Resize handle
    const handle = hitResizeHandle(g.x, g.y)
    if (handle) {
      dragMode.current = "resize"
      resizeHandle.current = handle
      return
    }

    // Item hit
    const hit = hitTest(g.x, g.y)
    if (hit) {
      if (!selectedIds.includes(hit.id)) {
        setSelectedIds([hit.id])
      }
      dragMode.current = "move"
      return
    }

    // Empty space — start marquee selection
    setSelectedIds([])
    marqueeRef.current = { x1: g.x, y1: g.y, x2: g.x, y2: g.y }
    dragMode.current = "marquee"
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
      saveCamera()
      return
    }

    if (dragMode.current === "marquee") {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const g = screenToGarden(sx, sy)
      if (marqueeRef.current) {
        marqueeRef.current.x2 = g.x
        marqueeRef.current.y2 = g.y
        const mq = marqueeRef.current
        const minX = Math.min(mq.x1, mq.x2)
        const maxX = Math.max(mq.x1, mq.x2)
        const minY = Math.min(mq.y1, mq.y2)
        const maxY = Math.max(mq.y1, mq.y2)
        const hits = items.filter(
          (it) => it.x >= minX && it.y >= minY && it.x + it.width <= maxX && it.y + it.depth <= maxY
        )
        setSelectedIds(hits.map((h) => h.id))
      }
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const s = transformRef.current.scale

    if (dragMode.current === "move" && selectedId) {
      setItems(
        items.map((it) =>
          selectedIds.includes(it.id)
            ? {
                ...it,
                x: snapToGrid(it.x + dx / s, gridSize),
                y: snapToGrid(it.y + dy / s, gridSize),
              }
            : it
        )
      )
      return
    }

    if (dragMode.current === "resize" && selectedId) {
      setItems(
        items.map((it) => {
          if (it.id !== selectedId) return it
          return {
            ...it,
            width: Math.max(
              gridSize,
              snapToGrid(it.width + dx / s, gridSize)
            ),
            depth: Math.max(
              gridSize,
              snapToGrid(it.depth + dy / s, gridSize)
            ),
          }
        })
      )
    }
  }

  function onPointerUp() {
    // Marquee selection — find items within rectangle
    if (dragMode.current === "marquee" && marqueeRef.current) {
      const mq = marqueeRef.current
      const minX = Math.min(mq.x1, mq.x2)
      const maxX = Math.max(mq.x1, mq.x2)
      const minY = Math.min(mq.y1, mq.y2)
      const maxY = Math.max(mq.y1, mq.y2)

      const hits = items.filter(
        (it) =>
          it.x >= minX &&
          it.y >= minY &&
          it.x + it.width <= maxX &&
          it.y + it.depth <= maxY
      )
      if (hits.length > 0) {
        setSelectedIds(hits.map((h) => h.id))
      }
      marqueeRef.current = null
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    }

    dragMode.current = "none"
    resizeHandle.current = null
    setIsPanning(false)
  }

  // Keyboard
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPlacingType(null)
        setHandMode(false)
        setSelectedIds([])
        return
      }
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return

      // Copy
      if ((e.metaKey || e.ctrlKey) && e.key === "c" && selectedIds.length > 0) {
        const idSet = new Set(selectedIds)
        const selected = items.filter((it) => idSet.has(it.id))
        copyToClipboard("detailed", selected)
        return
      }

      // Paste
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        e.preventDefault()
        pasteFromClipboard().then((payload) => {
          if (!payload || payload.phase !== "detailed") return
          const pasted = (payload.items as GardenItem[]).map((it) => ({
            ...offsetItem(it),
            id: crypto.randomUUID(),
          }))
          setItems([...items, ...pasted])
          setSelectedIds(pasted.map((p) => p.id))
        })
        return
      }

      if (selectedIds.length === 0) return
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        const idSet = new Set(selectedIds)
        setItems(items.filter((it) => !idSet.has(it.id)))
        setSelectedIds([])
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedIds, items, setItems])

  // --- Toolbar ---
  const selected = items.find((it) => it.id === selectedId)

  const deleteSelected = React.useCallback(() => {
    if (selectedIds.length === 0) return
    const idSet = new Set(selectedIds)
    setItems(items.filter((it) => !idSet.has(it.id)))
    setSelectedIds([])
  }, [selectedIds, items, setItems])

  const updateSelectedMeta = React.useCallback(
    (label: string) => {
      if (!selectedId) return
      setItems(
        items.map((it) =>
          it.id === selectedId
            ? { ...it, metadata: { ...it.metadata, label } }
            : it
        )
      )
    },
    [selectedId, items, setItems]
  )

  const cursorClass = placingType
    ? "cursor-crosshair"
    : handMode
      ? "cursor-grab active:cursor-grabbing"
      : "cursor-default"

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

      {/* Detail toolbar */}
      <div className="bg-background/80 border-border/50 fixed left-3 top-16 z-50 flex flex-col items-center gap-1 rounded-lg border p-1 shadow-lg backdrop-blur-xl">
        {/* Select tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={!placingType && !handMode ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => { setPlacingType(null); setHandMode(false) }}
            >
              <MousePointer2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Select</TooltipContent>
        </Tooltip>

        {/* Hand/pan tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={handMode || isPanning ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => { setHandMode(true); setPlacingType(null) }}
            >
              <Hand className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Pan</TooltipContent>
        </Tooltip>

        <Separator className="w-5" />

        {/* Surfaces */}
        {SURFACE_TYPES.map((type) => {
          const Icon = DETAIL_ICONS[type]
          return (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <Button
                  variant={placingType === type ? "default" : "ghost"}
                  size="icon-sm"
                  onClick={() =>
                    setPlacingType(placingType === type ? null : type)
                  }
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {DETAIL_ITEM_LABELS[type]}
              </TooltipContent>
            </Tooltip>
          )
        })}

        <Separator className="w-5" />

        {/* Structures */}
        {STRUCTURE_TYPES.map((type) => {
          const Icon = DETAIL_ICONS[type]
          return (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <Button
                  variant={placingType === type ? "default" : "ghost"}
                  size="icon-sm"
                  onClick={() =>
                    setPlacingType(placingType === type ? null : type)
                  }
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {DETAIL_ITEM_LABELS[type]}
              </TooltipContent>
            </Tooltip>
          )
        })}

        <Separator className="w-5" />

        {/* Water */}
        {WATER_TYPES.map((type) => {
          const Icon = DETAIL_ICONS[type]
          return (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <Button
                  variant={placingType === type ? "default" : "ghost"}
                  size="icon-sm"
                  onClick={() =>
                    setPlacingType(placingType === type ? null : type)
                  }
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {DETAIL_ITEM_LABELS[type]}
              </TooltipContent>
            </Tooltip>
          )
        })}

      </div>

      {/* Properties panel — to the right of toolbar */}
      {selected && (
        <div className="bg-background/80 border-border/50 fixed left-14 top-16 z-50 flex flex-col gap-1.5 rounded-lg border p-2 shadow-lg backdrop-blur-xl">
          <input
            type="text"
            value={(selected.metadata?.label as string) ?? ""}
            onChange={(e) => updateSelectedMeta(e.target.value)}
            className="border-border bg-transparent text-foreground focus:ring-ring w-32 rounded border px-2 py-1 text-xs outline-none focus:ring-1"
            placeholder={
              DETAIL_ITEM_LABELS[selected.type as DetailItemType] ??
              selected.type
            }
          />
          <div className="text-muted-foreground text-[10px]">
            {(selected.width / 100).toFixed(2)} × {(selected.depth / 100).toFixed(2)} m
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 text-xs"
            onClick={deleteSelected}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      )}
    </div>
  )
}
