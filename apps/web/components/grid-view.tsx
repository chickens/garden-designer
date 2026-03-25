"use client"

import * as React from "react"
import { useProject } from "@/lib/project-store"
import { useTheme } from "next-themes"

interface Transform {
  offsetX: number
  offsetY: number
  scale: number // px per cm
}

export function GridView() {
  const { project } = useProject()
  const { resolvedTheme } = useTheme()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const transformRef = React.useRef<Transform>({ offsetX: 0, offsetY: 0, scale: 1 })
  const isDragging = React.useRef(false)
  const lastMouse = React.useRef({ x: 0, y: 0 })
  const rafRef = React.useRef<number>(0)

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

    // Background
    ctx.fillStyle = isDark ? "#0a0a0a" : "#fafafa"
    ctx.fillRect(0, 0, rect.width, rect.height)

    // Transform: garden coords (cm) -> screen coords (px)
    const toScreenX = (cx: number) => offsetX + cx * scale
    const toScreenY = (cy: number) => offsetY + cy * scale

    // Garden fill
    ctx.fillStyle = isDark ? "#1a1f14" : "#f0f5e8"
    ctx.fillRect(toScreenX(0), toScreenY(0), gardenW * scale, gardenD * scale)

    // Adaptive grid: skip minor lines when zoomed out
    const minorSpacing = project.gridSize // 5cm
    const majorSpacing = 100 // 1m = 100cm
    const minPixelGap = 8
    const showMinor = minorSpacing * scale >= minPixelGap

    // Draw grid lines
    function drawGridLines(
      spacing: number,
      color: string,
      lineWidth: number
    ) {
      ctx!.strokeStyle = color
      ctx!.lineWidth = lineWidth

      // Vertical lines
      for (let x = 0; x <= gardenW; x += spacing) {
        const sx = Math.round(toScreenX(x)) + 0.5
        if (sx < -1 || sx > rect.width + 1) continue
        ctx!.beginPath()
        ctx!.moveTo(sx, toScreenY(0))
        ctx!.lineTo(sx, toScreenY(gardenD))
        ctx!.stroke()
      }

      // Horizontal lines
      for (let y = 0; y <= gardenD; y += spacing) {
        const sy = Math.round(toScreenY(y)) + 0.5
        if (sy < -1 || sy > rect.height + 1) continue
        ctx!.beginPath()
        ctx!.moveTo(toScreenX(0), sy)
        ctx!.lineTo(toScreenX(gardenW), sy)
        ctx!.stroke()
      }
    }

    // Minor grid (5cm)
    if (showMinor) {
      drawGridLines(
        minorSpacing,
        isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        0.5
      )
    }

    // Major grid (1m)
    drawGridLines(
      majorSpacing,
      isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
      1
    )

    // Garden border
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"
    ctx.lineWidth = 2
    ctx.strokeRect(toScreenX(0), toScreenY(0), gardenW * scale, gardenD * scale)

    // Dimension labels
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"
    ctx.font = "11px system-ui, sans-serif"
    ctx.textAlign = "center"

    // Width label (top)
    ctx.fillText(
      `${(gardenW / 100).toFixed(1)} m`,
      toScreenX(gardenW / 2),
      toScreenY(0) - 8
    )

    // Depth label (left)
    ctx.save()
    ctx.translate(toScreenX(0) - 8, toScreenY(gardenD / 2))
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(`${(gardenD / 100).toFixed(1)} m`, 0, 0)
    ctx.restore()

    // Meter markers along edges
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
  }, [project, resolvedTheme])

  // Center the garden on mount / project change
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

    const observer = new ResizeObserver(() => {
      draw()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [draw])

  // Wheel zoom centered on cursor
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

      // Zoom toward cursor
      t.offsetX = mx - (mx - t.offsetX) * (newScale / t.scale)
      t.offsetY = my - (my - t.offsetY) * (newScale / t.scale)
      t.scale = newScale

      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    }

    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [draw])

  // Pan via drag
  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    isDragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }

    transformRef.current.offsetX += dx
    transformRef.current.offsetY += dy

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(draw)
  }

  function onPointerUp() {
    isDragging.current = false
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  )
}
