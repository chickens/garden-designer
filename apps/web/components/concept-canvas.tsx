"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { Separator } from "@workspace/ui/components/separator"
import { Pentagon, Route, Trash2, MousePointer2, Hand } from "lucide-react"
import { useProject } from "@/lib/project-store"
import { useOverlays } from "./overlay-controls"
import { drawPhaseOverlay } from "@/lib/draw-overlays"
import { copyToClipboard, pasteFromClipboard } from "@/lib/clipboard"
import { useCanvasCamera } from "@/lib/use-canvas-camera"
import { useTheme } from "next-themes"
import type {
  ConceptPoint,
  ConceptShape,
  ConceptPath,
  ConceptData,
} from "@/lib/types"

interface Transform {
  offsetX: number
  offsetY: number
  scale: number
}

type Tool = "select" | "shape" | "path"
type DragMode = "none" | "pan" | "move-shape" | "move-path" | "move-point" | "marquee"

interface MarqueeRect {
  x1: number; y1: number; x2: number; y2: number
}

const SHAPE_COLORS = [
  "#4ade80", "#60a5fa", "#f472b6", "#facc15", "#a78bfa",
  "#fb923c", "#2dd4bf", "#e879f9", "#f87171", "#34d399",
]

export function ConceptCanvas() {
  const { project, updatePhaseData, setCamera } = useProject()
  const { resolvedTheme } = useTheme()
  const overlays = useOverlays()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const transformRef = React.useRef<Transform>({ offsetX: 0, offsetY: 0, scale: 1 })
  const rafRef = React.useRef<number>(0)

  const [tool, setTool] = React.useState<Tool>("select")
  const [handMode, setHandMode] = React.useState(false)
  const [isPanning, setIsPanning] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [selectedType, setSelectedType] = React.useState<"shape" | "path" | null>(null)
  const [drawingPoints, setDrawingPoints] = React.useState<ConceptPoint[]>([])

  const dragMode = React.useRef<DragMode>("none")
  const lastMouse = React.useRef({ x: 0, y: 0 })
  const dragPointIndex = React.useRef<number>(-1)
  const marqueeRef = React.useRef<MarqueeRect | null>(null)

  const conceptData: ConceptData = (project?.phases?.concept as ConceptData) ?? {
    shapes: [],
    paths: [],
  }
  const shapes = conceptData.shapes
  const paths = conceptData.paths

  // Bubble zones for faint reference layer

  const setData = React.useCallback(
    (data: ConceptData) => {
      updatePhaseData("concept", data)
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

  // Hit test: point inside polygon (ray casting)
  const pointInPolygon = React.useCallback(
    (gx: number, gy: number, points: ConceptPoint[]): boolean => {
      let inside = false
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const pi = points[i]!
        const pj = points[j]!
        if (
          pi.y > gy !== pj.y > gy &&
          gx < ((pj.x - pi.x) * (gy - pi.y)) / (pj.y - pi.y) + pi.x
        ) {
          inside = !inside
        }
      }
      return inside
    },
    []
  )

  // Hit test: point near polyline
  const pointNearPolyline = React.useCallback(
    (gx: number, gy: number, points: ConceptPoint[], width: number): boolean => {
      const threshold = Math.max(width / 2, 15 / transformRef.current.scale)
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i]!
        const b = points[i + 1]!
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len2 = dx * dx + dy * dy
        if (len2 === 0) continue
        let t = ((gx - a.x) * dx + (gy - a.y) * dy) / len2
        t = Math.max(0, Math.min(1, t))
        const px = a.x + t * dx
        const py = a.y + t * dy
        const dist = Math.sqrt((gx - px) ** 2 + (gy - py) ** 2)
        if (dist < threshold) return true
      }
      return false
    },
    []
  )

  // Hit test: near a vertex point of selected item
  const hitPoint = React.useCallback(
    (gx: number, gy: number, points: ConceptPoint[]): number => {
      const threshold = 10 / transformRef.current.scale
      for (let i = 0; i < points.length; i++) {
        const p = points[i]!
        if (Math.abs(gx - p.x) < threshold && Math.abs(gy - p.y) < threshold) {
          return i
        }
      }
      return -1
    },
    []
  )

  const hitTestShape = React.useCallback(
    (gx: number, gy: number): ConceptShape | null => {
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (pointInPolygon(gx, gy, shapes[i]!.points)) return shapes[i]!
      }
      return null
    },
    [shapes, pointInPolygon]
  )

  const hitTestPath = React.useCallback(
    (gx: number, gy: number): ConceptPath | null => {
      for (let i = paths.length - 1; i >= 0; i--) {
        if (pointNearPolyline(gx, gy, paths[i]!.points, paths[i]!.width))
          return paths[i]!
      }
      return null
    },
    [paths, pointNearPolyline]
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

    // Phase overlays
    if (project) {
      const dc = { ctx, toScreenX, toScreenY, scale, isDark }
      for (const phase of overlays) {
        drawPhaseOverlay(dc, project, phase, "concept")
      }
    }

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

    // Draw concept shapes (polygons)
    for (const shape of shapes) {
      if (shape.points.length < 2) continue
      const isSelected = shape.id === selectedId

      ctx.beginPath()
      ctx.moveTo(toScreenX(shape.points[0]!.x), toScreenY(shape.points[0]!.y))
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(toScreenX(shape.points[i]!.x), toScreenY(shape.points[i]!.y))
      }
      ctx.closePath()

      ctx.fillStyle = shape.color + "30"
      ctx.fill()
      ctx.strokeStyle = isSelected ? (isDark ? "#fff" : "#000") : shape.color
      ctx.lineWidth = isSelected ? 2.5 : 1.5
      ctx.stroke()

      // Label at centroid
      if (shape.label && shape.points.length >= 3) {
        const cx =
          shape.points.reduce((s, p) => s + p.x, 0) / shape.points.length
        const cy =
          shape.points.reduce((s, p) => s + p.y, 0) / shape.points.length
        ctx.fillStyle = isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)"
        ctx.font = "12px system-ui, sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(shape.label, toScreenX(cx), toScreenY(cy))
      }

      // Vertex handles when selected
      if (isSelected) {
        for (const p of shape.points) {
          ctx.fillStyle = shape.color
          ctx.fillRect(toScreenX(p.x) - 4, toScreenY(p.y) - 4, 8, 8)
          ctx.strokeStyle = isDark ? "#fff" : "#000"
          ctx.lineWidth = 1
          ctx.strokeRect(toScreenX(p.x) - 4, toScreenY(p.y) - 4, 8, 8)
        }
      }
    }

    // Draw concept paths (polylines)
    for (const path of paths) {
      if (path.points.length < 2) continue
      const isSelected = path.id === selectedId

      // Path fill (width)
      ctx.beginPath()
      ctx.moveTo(toScreenX(path.points[0]!.x), toScreenY(path.points[0]!.y))
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(toScreenX(path.points[i]!.x), toScreenY(path.points[i]!.y))
      }
      ctx.strokeStyle = isDark ? "rgba(200,190,170,0.5)" : "rgba(180,170,150,0.6)"
      ctx.lineWidth = path.width * scale
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.stroke()

      // Path outline
      ctx.strokeStyle = isSelected
        ? (isDark ? "#fff" : "#000")
        : (isDark ? "rgba(200,190,170,0.8)" : "rgba(140,130,110,0.7)")
      ctx.lineWidth = isSelected ? 2.5 : 1
      ctx.stroke()

      // Label at midpoint
      if (path.label && path.points.length >= 2) {
        const mid = Math.floor(path.points.length / 2)
        const mp = path.points[mid]!
        ctx.fillStyle = isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)"
        ctx.font = "11px system-ui, sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "bottom"
        ctx.fillText(path.label, toScreenX(mp.x), toScreenY(mp.y) - 6)
      }

      // Vertex handles when selected
      if (isSelected) {
        for (const p of path.points) {
          ctx.fillStyle = isDark ? "#d6d3d1" : "#78716c"
          ctx.beginPath()
          ctx.arc(toScreenX(p.x), toScreenY(p.y), 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = isDark ? "#fff" : "#000"
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }
    }

    // Drawing in progress
    if (drawingPoints.length > 0) {
      ctx.beginPath()
      ctx.moveTo(
        toScreenX(drawingPoints[0]!.x),
        toScreenY(drawingPoints[0]!.y)
      )
      for (let i = 1; i < drawingPoints.length; i++) {
        ctx.lineTo(
          toScreenX(drawingPoints[i]!.x),
          toScreenY(drawingPoints[i]!.y)
        )
      }

      if (tool === "shape") {
        ctx.setLineDash([6, 4])
        ctx.strokeStyle = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)"
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        ctx.strokeStyle = isDark ? "rgba(200,190,170,0.6)" : "rgba(140,130,110,0.6)"
        ctx.lineWidth = 60 * scale
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.stroke()
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Draw vertices
      for (const p of drawingPoints) {
        ctx.fillStyle = isDark ? "#fff" : "#000"
        ctx.beginPath()
        ctx.arc(toScreenX(p.x), toScreenY(p.y), 4, 0, Math.PI * 2)
        ctx.fill()
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
  }, [
    project,
    shapes,
    paths,
    selectedId,
    drawingPoints,
    tool,
    overlays,
    resolvedTheme,
  ])

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

    if (handMode) {
      dragMode.current = "pan"
      return
    }

    // Drawing modes: add point on click
    if (tool === "shape" || tool === "path") {
      setDrawingPoints((pts) => [...pts, { x: g.x, y: g.y }])
      dragMode.current = "none"
      return
    }

    // Select mode
    // Check vertex drag on selected item
    if (selectedId && selectedType === "shape") {
      const shape = shapes.find((s) => s.id === selectedId)
      if (shape) {
        const pi = hitPoint(g.x, g.y, shape.points)
        if (pi >= 0) {
          dragMode.current = "move-point"
          dragPointIndex.current = pi
          return
        }
      }
    }
    if (selectedId && selectedType === "path") {
      const path = paths.find((p) => p.id === selectedId)
      if (path) {
        const pi = hitPoint(g.x, g.y, path.points)
        if (pi >= 0) {
          dragMode.current = "move-point"
          dragPointIndex.current = pi
          return
        }
      }
    }

    // Hit test shapes
    const hitShape = hitTestShape(g.x, g.y)
    if (hitShape) {
      setSelectedId(hitShape.id)
      setSelectedType("shape")
      dragMode.current = "move-shape"
      return
    }

    // Hit test paths
    const hitPath = hitTestPath(g.x, g.y)
    if (hitPath) {
      setSelectedId(hitPath.id)
      setSelectedType("path")
      dragMode.current = "move-path"
      return
    }

    setSelectedId(null)
    setSelectedType(null)
    if (tool === "select") {
      const g2 = screenToGarden(sx, sy)
      marqueeRef.current = { x1: g2.x, y1: g2.y, x2: g2.x, y2: g2.y }
      dragMode.current = "marquee"
    } else {
      dragMode.current = "pan"
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
        // Select first shape whose centroid is in the rect
        const hitShape = shapes.find((sh) => {
          if (sh.points.length === 0) return false
          const cx = sh.points.reduce((s, p) => s + p.x, 0) / sh.points.length
          const cy = sh.points.reduce((s, p) => s + p.y, 0) / sh.points.length
          return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY
        })
        if (hitShape) {
          setSelectedId(hitShape.id)
          setSelectedType("shape")
        } else {
          const hitPath = paths.find((pa) => {
            if (pa.points.length === 0) return false
            const cx = pa.points.reduce((s, p) => s + p.x, 0) / pa.points.length
            const cy = pa.points.reduce((s, p) => s + p.y, 0) / pa.points.length
            return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY
          })
          if (hitPath) {
            setSelectedId(hitPath.id)
            setSelectedType("path")
          } else {
            setSelectedId(null)
            setSelectedType(null)
          }
        }
      }
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const s = transformRef.current.scale
    const gdx = dx / s
    const gdy = dy / s

    if (dragMode.current === "move-shape" && selectedId) {
      setData({
        ...conceptData,
        shapes: shapes.map((sh) =>
          sh.id === selectedId
            ? {
                ...sh,
                points: sh.points.map((p) => ({
                  x: p.x + gdx,
                  y: p.y + gdy,
                })),
              }
            : sh
        ),
      })
      return
    }

    if (dragMode.current === "move-path" && selectedId) {
      setData({
        ...conceptData,
        paths: paths.map((pa) =>
          pa.id === selectedId
            ? {
                ...pa,
                points: pa.points.map((p) => ({
                  x: p.x + gdx,
                  y: p.y + gdy,
                })),
              }
            : pa
        ),
      })
      return
    }

    if (dragMode.current === "move-point" && selectedId) {
      const idx = dragPointIndex.current
      if (selectedType === "shape") {
        setData({
          ...conceptData,
          shapes: shapes.map((sh) =>
            sh.id === selectedId
              ? {
                  ...sh,
                  points: sh.points.map((p, i) =>
                    i === idx ? { x: p.x + gdx, y: p.y + gdy } : p
                  ),
                }
              : sh
          ),
        })
      } else if (selectedType === "path") {
        setData({
          ...conceptData,
          paths: paths.map((pa) =>
            pa.id === selectedId
              ? {
                  ...pa,
                  points: pa.points.map((p, i) =>
                    i === idx ? { x: p.x + gdx, y: p.y + gdy } : p
                  ),
                }
              : pa
          ),
        })
      }
    }
  }

  function onPointerUp() {
    if (dragMode.current === "marquee" && marqueeRef.current) {
      marqueeRef.current = null
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    }
    dragMode.current = "none"
    dragPointIndex.current = -1
    setIsPanning(false)
  }

  // Double-click: finish drawing
  function onDoubleClick() {
    if (tool === "shape" && drawingPoints.length >= 3) {
      const colorIndex = shapes.length % SHAPE_COLORS.length
      const newShape: ConceptShape = {
        id: crypto.randomUUID(),
        label: "",
        points: drawingPoints,
        color: SHAPE_COLORS[colorIndex]!,
      }
      setData({ ...conceptData, shapes: [...shapes, newShape] })
      setDrawingPoints([])
      setSelectedId(newShape.id)
      setSelectedType("shape")
      setTool("select")
      return
    }

    if (tool === "path" && drawingPoints.length >= 2) {
      const newPath: ConceptPath = {
        id: crypto.randomUUID(),
        label: "",
        points: drawingPoints,
        width: 60, // 60cm default
      }
      setData({ ...conceptData, paths: [...paths, newPath] })
      setDrawingPoints([])
      setSelectedId(newPath.id)
      setSelectedType("path")
      setTool("select")
      return
    }
  }

  // Keyboard
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDrawingPoints([])
        setTool("select")
        setHandMode(false)
        setSelectedId(null)
        setSelectedType(null)
        return
      }
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return

      // Copy
      if ((e.metaKey || e.ctrlKey) && e.key === "c" && selectedId) {
        if (selectedType === "shape") {
          const shape = shapes.find((s) => s.id === selectedId)
          if (shape) copyToClipboard("concept-shape", [shape])
        } else if (selectedType === "path") {
          const path = paths.find((p) => p.id === selectedId)
          if (path) copyToClipboard("concept-path", [path])
        }
        return
      }

      // Paste
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        e.preventDefault()
        pasteFromClipboard().then((payload) => {
          if (!payload) return
          if (payload.phase === "concept-shape") {
            const pasted = (payload.items as typeof shapes).map((s) => ({
              ...s,
              id: crypto.randomUUID(),
              points: s.points.map((p) => ({ x: p.x + 20, y: p.y + 20 })),
            }))
            setData({ ...conceptData, shapes: [...shapes, ...pasted] })
            if (pasted.length > 0) {
              setSelectedId(pasted[0]!.id)
              setSelectedType("shape")
            }
          } else if (payload.phase === "concept-path") {
            const pasted = (payload.items as typeof paths).map((p) => ({
              ...p,
              id: crypto.randomUUID(),
              points: p.points.map((pt) => ({ x: pt.x + 20, y: pt.y + 20 })),
            }))
            setData({ ...conceptData, paths: [...paths, ...pasted] })
            if (pasted.length > 0) {
              setSelectedId(pasted[0]!.id)
              setSelectedType("path")
            }
          }
        })
        return
      }

      if (
        selectedId &&
        (e.key === "Delete" || e.key === "Backspace")
      ) {
        e.preventDefault()
        if (selectedType === "shape") {
          setData({
            ...conceptData,
            shapes: shapes.filter((s) => s.id !== selectedId),
          })
        } else if (selectedType === "path") {
          setData({
            ...conceptData,
            paths: paths.filter((p) => p.id !== selectedId),
          })
        }
        setSelectedId(null)
        setSelectedType(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedId, selectedType, shapes, paths, conceptData, setData])

  // --- Toolbar ---
  const selectedShape = selectedType === "shape" ? shapes.find((s) => s.id === selectedId) : null
  const selectedPath = selectedType === "path" ? paths.find((p) => p.id === selectedId) : null

  const updateSelectedShape = React.useCallback(
    (updates: Partial<ConceptShape>) => {
      if (!selectedId) return
      setData({
        ...conceptData,
        shapes: shapes.map((s) =>
          s.id === selectedId ? { ...s, ...updates } : s
        ),
      })
    },
    [selectedId, shapes, conceptData, setData]
  )

  const updateSelectedPath = React.useCallback(
    (updates: Partial<ConceptPath>) => {
      if (!selectedId) return
      setData({
        ...conceptData,
        paths: paths.map((p) =>
          p.id === selectedId ? { ...p, ...updates } : p
        ),
      })
    },
    [selectedId, paths, conceptData, setData]
  )

  const deleteSelected = React.useCallback(() => {
    if (!selectedId) return
    if (selectedType === "shape") {
      setData({ ...conceptData, shapes: shapes.filter((s) => s.id !== selectedId) })
    } else {
      setData({ ...conceptData, paths: paths.filter((p) => p.id !== selectedId) })
    }
    setSelectedId(null)
    setSelectedType(null)
  }, [selectedId, selectedType, shapes, paths, conceptData, setData])

  const isDrawing = drawingPoints.length > 0

  const cursorClass =
    handMode
      ? "cursor-grab active:cursor-grabbing"
      : tool === "shape" || tool === "path"
        ? "cursor-crosshair"
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
        onDoubleClick={onDoubleClick}
      />

      {/* Concept toolbar */}
      <div className="bg-background/80 border-border/50 fixed left-3 top-16 z-50 flex flex-col items-center gap-1 rounded-lg border p-1 shadow-lg backdrop-blur-xl">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={tool === "select" && !handMode ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => {
                setTool("select")
                setHandMode(false)
                setDrawingPoints([])
              }}
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
              onClick={() => { setHandMode(true); setTool("select"); setDrawingPoints([]) }}
            >
              <Hand className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Pan</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={tool === "shape" ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => {
                setTool("shape")
                setDrawingPoints([])
                setSelectedId(null)
              }}
            >
              <Pentagon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Draw Area
            {isDrawing && tool === "shape" && " (double-click to finish)"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={tool === "path" ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => {
                setTool("path")
                setDrawingPoints([])
                setSelectedId(null)
              }}
            >
              <Route className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Draw Path
            {isDrawing && tool === "path" && " (double-click to finish)"}
          </TooltipContent>
        </Tooltip>

      </div>

      {/* Drawing hint */}
      {isDrawing && (
        <div className="bg-background/80 border-border/50 fixed left-14 top-16 z-50 rounded-lg border px-2 py-1.5 text-[10px] text-muted-foreground shadow-lg backdrop-blur-xl">
          Click to add points.<br />Double-click to finish.
        </div>
      )}

      {/* Properties panel — shape */}
      {selectedShape && (
        <div className="bg-background/80 border-border/50 fixed left-14 top-16 z-50 flex flex-col gap-1.5 rounded-lg border p-2 shadow-lg backdrop-blur-xl">
          <input
            type="text"
            value={selectedShape.label}
            onChange={(e) => updateSelectedShape({ label: e.target.value })}
            className="border-border bg-transparent text-foreground focus:ring-ring w-32 rounded border px-2 py-1 text-xs outline-none focus:ring-1"
            placeholder="Label"
          />
          <label className="hover:bg-accent flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs">
            <input
              type="color"
              value={selectedShape.color}
              onChange={(e) => updateSelectedShape({ color: e.target.value })}
              className="sr-only"
            />
            <div
              className="border-border h-3.5 w-3.5 rounded-full border"
              style={{ backgroundColor: selectedShape.color }}
            />
            <span className="text-muted-foreground">Color</span>
          </label>
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

      {/* Properties panel — path */}
      {selectedPath && (
        <div className="bg-background/80 border-border/50 fixed left-14 top-16 z-50 flex flex-col gap-1.5 rounded-lg border p-2 shadow-lg backdrop-blur-xl">
          <input
            type="text"
            value={selectedPath.label}
            onChange={(e) => updateSelectedPath({ label: e.target.value })}
            className="border-border bg-transparent text-foreground focus:ring-ring w-32 rounded border px-2 py-1 text-xs outline-none focus:ring-1"
            placeholder="Label"
          />
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Width</span>
            <input
              type="number"
              min="10"
              step="10"
              value={Math.round(selectedPath.width)}
              onChange={(e) =>
                updateSelectedPath({
                  width: Math.max(10, parseInt(e.target.value) || 60),
                })
              }
              className="border-border bg-transparent text-foreground focus:ring-ring w-14 rounded border px-1.5 py-0.5 text-xs outline-none focus:ring-1"
            />
            <span className="text-muted-foreground">cm</span>
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
