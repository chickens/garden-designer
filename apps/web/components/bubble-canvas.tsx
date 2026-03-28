"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { Separator } from "@workspace/ui/components/separator"
import { Circle, Trash2, MousePointer2, Hand } from "lucide-react"
import { useProject } from "@/lib/project-store"
import { useOverlays } from "./overlay-controls"
import { drawPhaseOverlay } from "@/lib/draw-overlays"
import { copyToClipboard, pasteFromClipboard, offsetItemCenter } from "@/lib/clipboard"
import { useCanvasCamera } from "@/lib/use-canvas-camera"
import { useTheme } from "next-themes"
import type { BubbleZone } from "@/lib/types"

interface Transform {
  offsetX: number
  offsetY: number
  scale: number
}

const ZONE_COLORS = [
  "#4ade80", "#60a5fa", "#f472b6", "#facc15", "#a78bfa",
  "#fb923c", "#2dd4bf", "#e879f9", "#f87171", "#34d399",
]

type DragMode = "none" | "pan" | "move" | "resize" | "marquee"

interface MarqueeRect {
  x1: number; y1: number; x2: number; y2: number
}

export function BubbleCanvas() {
  const { project, updatePhaseData, setCamera } = useProject()
  const { resolvedTheme } = useTheme()
  const overlays = useOverlays()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const transformRef = React.useRef<Transform>({ offsetX: 0, offsetY: 0, scale: 1 })
  const rafRef = React.useRef<number>(0)

  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const selectedId = selectedIds[selectedIds.length - 1] ?? null
  const dragMode = React.useRef<DragMode>("none")
  const lastMouse = React.useRef({ x: 0, y: 0 })
  const resizeHandle = React.useRef<"n" | "s" | "e" | "w" | null>(null)
  const [handMode, setHandMode] = React.useState(false)
  const [isPanning, setIsPanning] = React.useState(false)
  const marqueeRef = React.useRef<MarqueeRect | null>(null)

  const zones = project?.phases?.bubble?.zones ?? []

  const setZones = React.useCallback(
    (newZones: BubbleZone[]) => {
      updatePhaseData("bubble", { zones: newZones })
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
    (gx: number, gy: number): BubbleZone | null => {
      for (let i = zones.length - 1; i >= 0; i--) {
        const z = zones[i]!
        const dx = (gx - z.cx) / z.rx
        const dy = (gy - z.cy) / z.ry
        if (dx * dx + dy * dy <= 1) return z
      }
      return null
    },
    [zones]
  )

  const hitResizeHandle = React.useCallback(
    (gx: number, gy: number): "n" | "s" | "e" | "w" | null => {
      if (!selectedId) return null
      const z = zones.find((z) => z.id === selectedId)
      if (!z) return null

      const handleSize = 12 / transformRef.current.scale
      const handles: { dir: "n" | "s" | "e" | "w"; hx: number; hy: number }[] = [
        { dir: "n", hx: z.cx, hy: z.cy - z.ry },
        { dir: "s", hx: z.cx, hy: z.cy + z.ry },
        { dir: "e", hx: z.cx + z.rx, hy: z.cy },
        { dir: "w", hx: z.cx - z.rx, hy: z.cy },
      ]

      for (const h of handles) {
        if (Math.abs(gx - h.hx) < handleSize && Math.abs(gy - h.hy) < handleSize) {
          return h.dir
        }
      }
      return null
    },
    [selectedId, zones]
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

    // Garden fill (no grid — bubble diagrams are freeform)
    ctx.fillStyle = isDark ? "#1a1f14" : "#f0f5e8"
    ctx.fillRect(toScreenX(0), toScreenY(0), gardenW * scale, gardenD * scale)

    // Phase overlays
    if (project) {
      const dc = { ctx, toScreenX, toScreenY, scale, isDark }
      for (const phase of overlays) {
        drawPhaseOverlay(dc, project, phase, "bubble")
      }
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

    // Draw bubble zones
    for (const zone of zones) {
      const sx = toScreenX(zone.cx)
      const sy = toScreenY(zone.cy)
      const srx = zone.rx * scale
      const sry = zone.ry * scale

      // Fill (semi-transparent)
      ctx.beginPath()
      ctx.ellipse(sx, sy, Math.max(1, srx), Math.max(1, sry), 0, 0, Math.PI * 2)
      ctx.fillStyle = zone.color + "40"
      ctx.fill()

      // Stroke
      ctx.strokeStyle = zone.color
      ctx.lineWidth = selectedIds.includes(zone.id) ? 3 : 2
      ctx.stroke()

      // Selection indicator
      const isSelected = selectedIds.includes(zone.id)
      if (isSelected) {
        ctx.setLineDash([6, 3])
        ctx.strokeStyle = isDark ? "#fff" : "#000"
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.setLineDash([])

        // Resize handles
        const handles = [
          { x: sx, y: sy - sry },
          { x: sx, y: sy + sry },
          { x: sx + srx, y: sy },
          { x: sx - srx, y: sy },
        ]
        for (const h of handles) {
          ctx.fillStyle = isDark ? "#fff" : "#000"
          ctx.fillRect(h.x - 4, h.y - 4, 8, 8)
          ctx.fillStyle = zone.color
          ctx.fillRect(h.x - 3, h.y - 3, 6, 6)
        }
      }

      // Label
      if (zone.label) {
        ctx.fillStyle = isDark ? "#fff" : "#000"
        ctx.font = `${Math.max(10, Math.min(14, srx / 3))}px system-ui, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(zone.label, sx, sy, srx * 1.8)
      }
    }

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
  }, [project, zones, selectedIds, overlays, resolvedTheme])

  const { saveCamera } = useCanvasCamera(containerRef, transformRef, project, setCamera, draw)

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
      saveCamera()
    }

    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [draw, saveCamera])

  // Pointer handlers
  function onPointerDown(e: React.PointerEvent) {
    if (e.button === 1) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId)
      lastMouse.current = { x: e.clientX, y: e.clientY }
      dragMode.current = "pan"
      setIsPanning(true)
      return
    }
    if (e.button !== 0) return
    if (handMode) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId)
      lastMouse.current = { x: e.clientX, y: e.clientY }
      dragMode.current = "pan"
      return
    }
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const g = screenToGarden(sx, sy)

    lastMouse.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    const handle = hitResizeHandle(g.x, g.y)
    if (handle) {
      dragMode.current = "resize"
      resizeHandle.current = handle
      return
    }

    const hit = hitTest(g.x, g.y)
    if (hit) {
      if (!selectedIds.includes(hit.id)) {
        setSelectedIds([hit.id])
      }
      dragMode.current = "move"
      return
    }

    setSelectedIds([])
    const g2 = screenToGarden(sx, sy)
    marqueeRef.current = { x1: g2.x, y1: g2.y, x2: g2.x, y2: g2.y }
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
      const rect2 = canvasRef.current?.getBoundingClientRect()
      if (!rect2) return
      const g2 = screenToGarden(e.clientX - rect2.left, e.clientY - rect2.top)
      if (marqueeRef.current) {
        marqueeRef.current.x2 = g2.x
        marqueeRef.current.y2 = g2.y
        const mq = marqueeRef.current
        const minX = Math.min(mq.x1, mq.x2)
        const maxX = Math.max(mq.x1, mq.x2)
        const minY = Math.min(mq.y1, mq.y2)
        const maxY = Math.max(mq.y1, mq.y2)
        const hits = zones.filter(
          (z) => z.cx >= minX && z.cx <= maxX && z.cy >= minY && z.cy <= maxY
        )
        setSelectedIds(hits.map((h) => h.id))
      }
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    if (dragMode.current === "move" && selectedIds.length > 0) {
      const scale = transformRef.current.scale
      const idSet = new Set(selectedIds)
      setZones(
        zones.map((z) =>
          idSet.has(z.id)
            ? { ...z, cx: z.cx + dx / scale, cy: z.cy + dy / scale }
            : z
        )
      )
      return
    }

    if (dragMode.current === "resize" && selectedId && resizeHandle.current) {
      const scale = transformRef.current.scale
      const gdx = dx / scale
      const gdy = dy / scale
      setZones(
        zones.map((z) => {
          if (z.id !== selectedId) return z
          const minR = 20
          switch (resizeHandle.current) {
            case "e":
              return { ...z, rx: Math.max(minR, z.rx + gdx) }
            case "w":
              return { ...z, rx: Math.max(minR, z.rx - gdx) }
            case "s":
              return { ...z, ry: Math.max(minR, z.ry + gdy) }
            case "n":
              return { ...z, ry: Math.max(minR, z.ry - gdy) }
            default:
              return z
          }
        })
      )
    }
  }

  function onPointerUp() {
    if (dragMode.current === "marquee" && marqueeRef.current) {
      const mq = marqueeRef.current
      const minX = Math.min(mq.x1, mq.x2)
      const maxX = Math.max(mq.x1, mq.x2)
      const minY = Math.min(mq.y1, mq.y2)
      const maxY = Math.max(mq.y1, mq.y2)
      const hits = zones.filter((z) => {
        return z.cx >= minX && z.cx <= maxX && z.cy >= minY && z.cy <= maxY
      })
      if (hits.length > 0) setSelectedIds(hits.map((h) => h.id))
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
        setHandMode(false)
        setSelectedIds([])
        return
      }
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return

      if ((e.metaKey || e.ctrlKey) && e.key === "c" && selectedIds.length > 0) {
        const idSet = new Set(selectedIds)
        copyToClipboard("bubble", zones.filter((z) => idSet.has(z.id)))
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        e.preventDefault()
        pasteFromClipboard().then((payload) => {
          if (!payload || payload.phase !== "bubble") return
          const pasted = (payload.items as typeof zones).map((z) => ({
            ...offsetItemCenter(z),
            id: crypto.randomUUID(),
          }))
          setZones([...zones, ...pasted])
          setSelectedIds(pasted.map((p) => p.id))
        })
        return
      }

      if (selectedIds.length === 0) return
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        const idSet = new Set(selectedIds)
        setZones(zones.filter((z) => !idSet.has(z.id)))
        setSelectedIds([])
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedIds, zones, setZones])

  // --- Toolbar actions ---

  const addZone = React.useCallback(() => {
    if (!project) return
    const { width, depth } = project.dimensions
    const colorIndex = zones.length % ZONE_COLORS.length
    const newZone: BubbleZone = {
      id: crypto.randomUUID(),
      label: "Zone",
      cx: width / 2,
      cy: depth / 2,
      rx: Math.min(width, depth) / 6,
      ry: Math.min(width, depth) / 6,
      color: ZONE_COLORS[colorIndex]!,
      rotation: 0,
    }
    const updated = [...zones, newZone]
    updatePhaseData("bubble", { zones: updated })
    setSelectedIds([newZone.id])
  }, [project, zones, updatePhaseData])

  const selected = zones.find((z) => z.id === selectedId)

  const updateSelected = React.useCallback(
    (updates: Partial<BubbleZone>) => {
      if (!selectedId) return
      setZones(zones.map((z) => (z.id === selectedId ? { ...z, ...updates } : z)))
    },
    [selectedId, zones, setZones]
  )

  const deleteSelected = React.useCallback(() => {
    if (selectedIds.length === 0) return
    const idSet = new Set(selectedIds)
    setZones(zones.filter((z) => !idSet.has(z.id)))
    setSelectedIds([])
  }, [selectedIds, zones, setZones])

  const cursorClass = handMode ? "cursor-grab active:cursor-grabbing" : "cursor-default"

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

      {/* Bubble toolbar — below file toolbar */}
      <div className="bg-background/80 border-border/50 fixed left-3 top-16 z-50 flex flex-col items-center gap-1 rounded-lg border p-1 shadow-lg backdrop-blur-xl">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={!handMode ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setHandMode(false)}
            >
              <MousePointer2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Select</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={handMode || isPanning ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setHandMode(true)}
            >
              <Hand className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Pan</TooltipContent>
        </Tooltip>

        <Separator className="w-5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={addZone}>
              <Circle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Add Zone</TooltipContent>
        </Tooltip>

      </div>

      {/* Properties panel */}
      {selected && (
        <div className="bg-background/80 border-border/50 fixed left-14 top-16 z-50 flex flex-col gap-1.5 rounded-lg border p-2 shadow-lg backdrop-blur-xl">
          <input
            type="text"
            value={selected.label}
            onChange={(e) => updateSelected({ label: e.target.value })}
            className="border-border bg-transparent text-foreground focus:ring-ring w-32 rounded border px-2 py-1 text-xs outline-none focus:ring-1"
            placeholder="Label"
          />
          <div className="flex items-center gap-2">
            <label className="hover:bg-accent flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs">
              <input
                type="color"
                value={selected.color}
                onChange={(e) => updateSelected({ color: e.target.value })}
                className="sr-only"
              />
              <div
                className="border-border h-3.5 w-3.5 rounded-full border"
                style={{ backgroundColor: selected.color }}
              />
              <span className="text-muted-foreground">Color</span>
            </label>
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
