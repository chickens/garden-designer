"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { Separator } from "@workspace/ui/components/separator"
import { Circle, Trash2 } from "lucide-react"
import { useProject } from "@/lib/project-store"
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

type DragMode = "none" | "pan" | "move" | "resize"

export function BubbleCanvas() {
  const { project, updatePhaseData } = useProject()
  const { resolvedTheme } = useTheme()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const transformRef = React.useRef<Transform>({ offsetX: 0, offsetY: 0, scale: 1 })
  const rafRef = React.useRef<number>(0)

  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const dragMode = React.useRef<DragMode>("none")
  const lastMouse = React.useRef({ x: 0, y: 0 })
  const resizeHandle = React.useRef<"n" | "s" | "e" | "w" | null>(null)

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
      ctx.lineWidth = zone.id === selectedId ? 3 : 2
      ctx.stroke()

      // Selection indicator
      if (zone.id === selectedId) {
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
  }, [project, zones, selectedId, resolvedTheme])

  // Center garden on mount / project change
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

    const handle = hitResizeHandle(g.x, g.y)
    if (handle) {
      dragMode.current = "resize"
      resizeHandle.current = handle
      return
    }

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

    if (dragMode.current === "move" && selectedId) {
      const scale = transformRef.current.scale
      setZones(
        zones.map((z) =>
          z.id === selectedId
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
    dragMode.current = "none"
    resizeHandle.current = null
  }

  // Keyboard: delete selected zone
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!selectedId) return
      if (e.key === "Delete" || e.key === "Backspace") {
        const target = e.target as HTMLElement
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
        e.preventDefault()
        setZones(zones.filter((z) => z.id !== selectedId))
        setSelectedId(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedId, zones, setZones])

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
    setSelectedId(newZone.id)
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
    if (!selectedId) return
    setZones(zones.filter((z) => z.id !== selectedId))
    setSelectedId(null)
  }, [selectedId, zones, setZones])

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {/* Bubble toolbar — below file toolbar */}
      <div className="bg-background/80 border-border/50 fixed left-3 top-16 z-50 flex flex-col items-center gap-1 rounded-lg border p-1 shadow-lg backdrop-blur-xl">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={addZone}>
              <Circle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Add Zone</TooltipContent>
        </Tooltip>

        {selected && (
          <>
            <Separator className="w-5" />
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="hover:bg-accent flex h-7 w-7 cursor-pointer items-center justify-center rounded-md">
                  <input
                    type="color"
                    value={selected.color}
                    onChange={(e) => updateSelected({ color: e.target.value })}
                    className="sr-only"
                  />
                  <div
                    className="border-border h-4 w-4 rounded-full border"
                    style={{ backgroundColor: selected.color }}
                  />
                </label>
              </TooltipTrigger>
              <TooltipContent side="right">Color</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={deleteSelected}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Delete Zone</TooltipContent>
            </Tooltip>
            <Separator className="w-5" />
            <input
              type="text"
              value={selected.label}
              onChange={(e) => updateSelected({ label: e.target.value })}
              className="bg-transparent text-foreground focus:ring-ring w-20 rounded px-1 py-0.5 text-center text-xs outline-none focus:ring-1"
              placeholder="Label"
            />
          </>
        )}
      </div>
    </div>
  )
}
