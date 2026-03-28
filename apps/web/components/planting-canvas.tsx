"use client"

import * as React from "react"
import { useProject } from "@/lib/project-store"
import { useOverlays } from "./overlay-controls"
import { drawPhaseOverlay } from "@/lib/draw-overlays"
import { copyToClipboard, pasteFromClipboard } from "@/lib/clipboard"
import { useCanvasCamera } from "@/lib/use-canvas-camera"
import { useTheme } from "next-themes"
import type {
  PlantDefinition,
  PlantPlacement,
  PlantingData,
} from "@/lib/types"
import {
  copyPlantToProject,
  saveProjectPlant,
  loadAllProjectPlants,
} from "@/lib/plant-library"
import { PlantPalette } from "./plant-palette"

interface Transform {
  offsetX: number
  offsetY: number
  scale: number
}

type DragMode = "none" | "pan" | "move" | "marquee"

interface MarqueeRect {
  x1: number; y1: number; x2: number; y2: number
}

export function PlantingCanvas() {
  const { project, updatePhaseData, hasDirHandle, save, setCamera } = useProject()
  const { resolvedTheme } = useTheme()
  const overlays = useOverlays()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const transformRef = React.useRef<Transform>({ offsetX: 0, offsetY: 0, scale: 1 })
  const rafRef = React.useRef<number>(0)

  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const selectedId = selectedIds[selectedIds.length - 1] ?? null
  const [placingPlant, setPlacingPlant] = React.useState<PlantDefinition | null>(null)
  const [handMode, setHandMode] = React.useState(false)
  const [isPanning, setIsPanning] = React.useState(false)
  const [plantDefs, setPlantDefs] = React.useState<Map<string, PlantDefinition>>(new Map())
  const dragMode = React.useRef<DragMode>("none")
  const lastMouse = React.useRef({ x: 0, y: 0 })
  const marqueeRef = React.useRef<MarqueeRect | null>(null)

  // Access dirHandle via a ref trick — we need it for plant file operations
  const dirHandleRef = React.useRef<FileSystemDirectoryHandle | null>(null)

  const plantingData: PlantingData = (project?.phases?.planting as PlantingData) ?? {
    placements: [],
    projectPlants: [],
  }
  const placements = plantingData.placements
  const projectPlantIds = plantingData.projectPlants
  const savedDefs = plantingData.plantDefinitions ?? {}

  // Initialize plantDefs from saved definitions on mount
  React.useEffect(() => {
    if (Object.keys(savedDefs).length > 0) {
      setPlantDefs((prev) => {
        const next = new Map(prev)
        for (const [id, def] of Object.entries(savedDefs)) {
          if (!next.has(id)) next.set(id, def)
        }
        return next
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setData = React.useCallback(
    (data: PlantingData) => {
      updatePhaseData("planting", data)
    },
    [updatePhaseData]
  )

  // Helper to persist a plant def alongside the data
  const addPlantDef = React.useCallback(
    (plant: PlantDefinition) => {
      setPlantDefs((prev) => new Map(prev).set(plant.id, plant))
      // Also persist in project data so it survives tab switches
      const currentData = (project?.phases?.planting as PlantingData) ?? {
        placements: [],
        projectPlants: [],
      }
      const updatedDefs = { ...(currentData.plantDefinitions ?? {}), [plant.id]: plant }
      updatePhaseData("planting", { ...currentData, plantDefinitions: updatedDefs })
    },
    [project, updatePhaseData]
  )

  const screenToGarden = React.useCallback((sx: number, sy: number) => {
    const t = transformRef.current
    return {
      x: (sx - t.offsetX) / t.scale,
      y: (sy - t.offsetY) / t.scale,
    }
  }, [])

  const hitTest = React.useCallback(
    (gx: number, gy: number): PlantPlacement | null => {
      for (let i = placements.length - 1; i >= 0; i--) {
        const p = placements[i]!
        const def = plantDefs.get(p.plantId)
        const r = def ? def.spread.max / 2 : 25
        const dx = gx - p.x
        const dy = gy - p.y
        if (dx * dx + dy * dy <= r * r) return p
      }
      return null
    },
    [placements, plantDefs]
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

    // Light grid (1m)
    const majorSpacing = 100
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
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

    // Phase overlays
    if (project) {
      const dc = { ctx, toScreenX, toScreenY, scale, isDark }
      for (const phase of overlays) {
        drawPhaseOverlay(dc, project, phase, "planting")
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

    // Draw plant placements
    for (const placement of placements) {
      const def = plantDefs.get(placement.plantId)
      const color = def?.color ?? "#4ade80"
      const spreadR = def ? (def.spread.max / 2) * scale : 25 * scale
      const isSelected = selectedIds.includes(placement.id)

      const sx = toScreenX(placement.x)
      const sy = toScreenY(placement.y)

      // Spread circle (faint)
      ctx.beginPath()
      ctx.arc(sx, sy, spreadR, 0, Math.PI * 2)
      ctx.fillStyle = color + "20"
      ctx.fill()
      ctx.strokeStyle = color + "60"
      ctx.lineWidth = isSelected ? 2 : 1
      ctx.setLineDash(isSelected ? [] : [4, 3])
      ctx.stroke()
      ctx.setLineDash([])

      // Center dot
      const dotR = Math.max(4, spreadR * 0.15)
      ctx.beginPath()
      ctx.arc(sx, sy, dotR, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = isDark ? "#fff" : "#000"
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Label
      const name = def?.commonName ?? placement.plantId
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)"
      const fontSize = Math.max(8, Math.min(11, spreadR / 2))
      ctx.font = `${fontSize}px system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      ctx.fillText(name, sx, sy + dotR + 3, spreadR * 2)
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
  }, [project, placements, selectedIds, plantDefs, overlays, resolvedTheme])

  const { saveCamera } = useCanvasCamera(containerRef, transformRef, project, setCamera, draw)

  // Redraw when data changes
  React.useEffect(() => {
    draw()
  }, [draw])

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
    // Middle-click always pans
    if (e.button === 1) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId)
      lastMouse.current = { x: e.clientX, y: e.clientY }
      dragMode.current = "pan"
      setIsPanning(true)
      return
    }
    if (e.button !== 0) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const g = screenToGarden(sx, sy)
    lastMouse.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    // Hand mode — left-click pans
    if (handMode && !placingPlant) {
      dragMode.current = "pan"
      return
    }

    // Hit test existing plants first — always allow selecting/moving
    const hit = hitTest(g.x, g.y)
    if (hit) {
      // If clicked item is already in selection, keep the full selection for group move
      if (!selectedIds.includes(hit.id)) {
        setSelectedIds([hit.id])
      }
      setPlacingPlant(null)
      dragMode.current = "move"
      return
    }

    // Placing mode — click empty space to place
    if (placingPlant) {
      const newPlacement: PlantPlacement = {
        id: crypto.randomUUID(),
        plantId: placingPlant.id,
        x: g.x,
        y: g.y,
        quantity: 1,
      }
      setData({
        ...plantingData,
        placements: [...placements, newPlacement],
      })
      setSelectedIds([newPlacement.id])
      dragMode.current = "none"
      return
    }

    setSelectedIds([])
    if (handMode) {
      dragMode.current = "pan"
    } else {
      const g2 = screenToGarden(sx, sy)
      marqueeRef.current = { x1: g2.x, y1: g2.y, x2: g2.x, y2: g2.y }
      dragMode.current = "marquee"
    }
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
        const hits = placements.filter(
          (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
        )
        setSelectedIds(hits.map((h) => h.id))
      }
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    if (dragMode.current === "move" && selectedIds.length > 0) {
      const s = transformRef.current.scale
      const idSet = new Set(selectedIds)
      setData({
        ...plantingData,
        placements: placements.map((p) =>
          idSet.has(p.id)
            ? { ...p, x: p.x + dx / s, y: p.y + dy / s }
            : p
        ),
      })
    }
  }

  function onPointerUp() {
    if (dragMode.current === "marquee" && marqueeRef.current) {
      const mq = marqueeRef.current
      const minX = Math.min(mq.x1, mq.x2)
      const maxX = Math.max(mq.x1, mq.x2)
      const minY = Math.min(mq.y1, mq.y2)
      const maxY = Math.max(mq.y1, mq.y2)

      const hits = placements.filter(
        (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
      )
      if (hits.length > 0) {
        setSelectedIds(hits.map((h) => h.id))
      }
      marqueeRef.current = null
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    }
    dragMode.current = "none"
    setIsPanning(false)
  }

  // Keyboard
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPlacingPlant(null)
        setHandMode(false)
        setSelectedIds([])
        return
      }
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return

      if ((e.metaKey || e.ctrlKey) && e.key === "c" && selectedIds.length > 0) {
        const idSet = new Set(selectedIds)
        copyToClipboard("planting", placements.filter((p) => idSet.has(p.id)))
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        e.preventDefault()
        pasteFromClipboard().then((payload) => {
          if (!payload || payload.phase !== "planting") return
          const pasted = (payload.items as typeof placements).map((p) => ({
            ...p,
            id: crypto.randomUUID(),
            x: p.x + 20,
            y: p.y + 20,
          }))
          setData({
            ...plantingData,
            placements: [...placements, ...pasted],
          })
          setSelectedIds(pasted.map((p) => p.id))
        })
        return
      }

      if (selectedIds.length === 0) return
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        setData({
          ...plantingData,
          placements: placements.filter((p) => !selectedIds.includes(p.id)),
        })
        setSelectedIds([])
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedIds, placements, plantingData, setData])

  // --- Palette callbacks ---

  const handleSelectPlant = React.useCallback(
    (plant: PlantDefinition) => {
      addPlantDef(plant)
      setPlacingPlant(plant)
      setSelectedIds([])
    },
    [addPlantDef]
  )

  const handleAddFromLibrary = React.useCallback(
    async (plant: PlantDefinition) => {
      addPlantDef(plant)
      setPlacingPlant(plant)
      setSelectedIds([])
    },
    [addPlantDef]
  )

  const handleCreatePlant = React.useCallback(
    (plant: PlantDefinition) => {
      addPlantDef(plant)

      // Also add to project plant list
      if (!projectPlantIds.includes(plant.id)) {
        const currentData = (project?.phases?.planting as PlantingData) ?? {
          placements: [],
          projectPlants: [],
        }
        updatePhaseData("planting", {
          ...currentData,
          projectPlants: [...projectPlantIds, plant.id],
          plantDefinitions: { ...(currentData.plantDefinitions ?? {}), [plant.id]: plant },
        })
      }
    },
    [addPlantDef, projectPlantIds, project, updatePhaseData]
  )

  // Build project plants array from defs cache
  const projectPlantDefs = projectPlantIds
    .map((id) => plantDefs.get(id))
    .filter(Boolean) as PlantDefinition[]

  const cursorClass = placingPlant
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

      <PlantPalette
        projectPlants={projectPlantDefs}
        selectedPlantId={placingPlant?.id ?? null}
        selectedPlacementId={selectedId}
        isSelectMode={!placingPlant && !handMode}
        onSelectMode={() => {
          setPlacingPlant(null)
          setHandMode(false)
          setSelectedIds([])
        }}
        handMode={handMode}
        isPanning={isPanning}
        onHandMode={() => {
          setHandMode(true)
          setPlacingPlant(null)
        }}
        onSelectPlant={handleSelectPlant}
        onAddPlantToProject={handleAddFromLibrary}
        onCreatePlant={handleCreatePlant}
        onDeletePlacement={() => {
          if (selectedIds.length === 0) return
          setData({
            ...plantingData,
            placements: placements.filter((p) => !selectedIds.includes(p.id)),
          })
          setSelectedIds([])
        }}
      />

      {/* Placing hint */}
      {placingPlant && (
        <div className="bg-background/80 border-border/50 fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-3 py-1.5 text-xs shadow-lg backdrop-blur-xl">
          Placing <strong>{placingPlant.commonName}</strong> — click to place,
          Escape to cancel
        </div>
      )}
    </div>
  )
}
