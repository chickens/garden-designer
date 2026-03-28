import type {
  GardenProject,
  DesignPhase,
  BubbleZone,
  SurveyElement,
  ConceptShape,
  ConceptPath,
  ConceptData,
  GardenItem,
  PlantPlacement,
  PlantingData,
  SurveyData,
} from "./types"
import { DETAIL_ITEM_COLORS, type DetailItemType } from "./types"

interface DrawContext {
  ctx: CanvasRenderingContext2D
  toScreenX: (cx: number) => number
  toScreenY: (cy: number) => number
  scale: number
  isDark: boolean
}

export function drawPhaseOverlay(
  dc: DrawContext,
  project: GardenProject,
  phase: DesignPhase,
  currentPhase: DesignPhase
) {
  if (phase === currentPhase) return

  const { ctx } = dc
  ctx.save()
  ctx.globalAlpha = 0.2

  switch (phase) {
    case "survey":
      drawSurveyOverlay(dc, project.phases.survey)
      break
    case "bubble":
      drawBubbleOverlay(dc, project.phases.bubble)
      break
    case "concept":
      drawConceptOverlay(dc, project.phases.concept as ConceptData | undefined)
      break
    case "detailed":
      drawDetailOverlay(dc, project.phases.detailed)
      break
    case "planting":
      drawPlantingOverlay(dc, project.phases.planting as PlantingData | undefined)
      break
  }

  ctx.restore()
}

function drawSurveyOverlay(
  dc: DrawContext,
  data: SurveyData | undefined
) {
  if (!data) return
  const { ctx, toScreenX, toScreenY, scale, isDark } = dc

  for (const el of data.elements) {
    const sx = toScreenX(el.x)
    const sy = toScreenY(el.y)
    const sw = el.width * scale
    const sd = el.depth * scale

    if (el.type === "tree") {
      const cx = sx + sw / 2
      const cy = sy + sd / 2
      const r = Math.min(sw, sd) / 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = "#4ade80"
      ctx.fill()
      ctx.strokeStyle = "#22c55e"
      ctx.lineWidth = 1
      ctx.stroke()
    } else {
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)"
      ctx.fillRect(sx, sy, sw, sd)
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.25)"
      ctx.lineWidth = 1
      ctx.strokeRect(sx, sy, sw, sd)
    }
  }
}

function drawBubbleOverlay(
  dc: DrawContext,
  data: { zones: BubbleZone[] } | undefined
) {
  if (!data) return
  const { ctx, toScreenX, toScreenY, scale } = dc

  for (const zone of data.zones) {
    const sx = toScreenX(zone.cx)
    const sy = toScreenY(zone.cy)
    const srx = zone.rx * scale
    const sry = zone.ry * scale

    ctx.beginPath()
    ctx.ellipse(sx, sy, Math.max(1, srx), Math.max(1, sry), 0, 0, Math.PI * 2)
    ctx.fillStyle = zone.color + "30"
    ctx.fill()
    ctx.strokeStyle = zone.color
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])

    if (zone.label) {
      ctx.fillStyle = zone.color
      ctx.font = "10px system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(zone.label, sx, sy)
    }
  }
}

function drawConceptOverlay(dc: DrawContext, data: ConceptData | undefined) {
  if (!data) return
  const { ctx, toScreenX, toScreenY, scale, isDark } = dc

  for (const shape of data.shapes) {
    if (shape.points.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(toScreenX(shape.points[0]!.x), toScreenY(shape.points[0]!.y))
    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(toScreenX(shape.points[i]!.x), toScreenY(shape.points[i]!.y))
    }
    ctx.closePath()
    ctx.fillStyle = shape.color + "20"
    ctx.fill()
    ctx.strokeStyle = shape.color
    ctx.lineWidth = 1
    ctx.stroke()
  }

  for (const path of data.paths) {
    if (path.points.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(toScreenX(path.points[0]!.x), toScreenY(path.points[0]!.y))
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(toScreenX(path.points[i]!.x), toScreenY(path.points[i]!.y))
    }
    ctx.strokeStyle = isDark ? "rgba(200,190,170,0.5)" : "rgba(140,130,110,0.4)"
    ctx.lineWidth = path.width * scale
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.stroke()
  }
}

function drawDetailOverlay(
  dc: DrawContext,
  data: { items: GardenItem[] } | undefined
) {
  if (!data) return
  const { ctx, toScreenX, toScreenY, scale } = dc

  for (const item of data.items) {
    const sx = toScreenX(item.x)
    const sy = toScreenY(item.y)
    const sw = item.width * scale
    const sd = item.depth * scale
    const colors = DETAIL_ITEM_COLORS[item.type as DetailItemType] ?? {
      fill: "#9ca3af",
      stroke: "#6b7280",
    }

    ctx.fillStyle = colors.fill + "40"
    ctx.fillRect(sx, sy, sw, sd)
    ctx.strokeStyle = colors.stroke
    ctx.lineWidth = 1
    ctx.strokeRect(sx, sy, sw, sd)
  }
}

function drawPlantingOverlay(dc: DrawContext, data: PlantingData | undefined) {
  if (!data) return
  const { ctx, toScreenX, toScreenY, scale } = dc

  for (const p of data.placements) {
    const sx = toScreenX(p.x)
    const sy = toScreenY(p.y)
    const r = 25 * scale // default spread

    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, Math.PI * 2)
    ctx.fillStyle = "#4ade8040"
    ctx.fill()
    ctx.strokeStyle = "#4ade80"
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])
  }
}
