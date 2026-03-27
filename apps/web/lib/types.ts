export interface GardenDimensions {
  /** Width in cm */
  width: number
  /** Depth in cm */
  depth: number
}

export interface GardenItem {
  id: string
  type: string
  x: number
  y: number
  width: number
  depth: number
  rotation: number
  metadata?: Record<string, unknown>
}

// --- Design Phases ---

export type DesignPhase =
  | "survey"
  | "wishlist"
  | "bubble"
  | "concept"
  | "detailed"
  | "planting"

export const PHASE_ORDER: DesignPhase[] = [
  "survey",
  "wishlist",
  "bubble",
  "concept",
  "detailed",
  "planting",
]

export const PHASE_LABELS: Record<DesignPhase, string> = {
  survey: "Survey",
  wishlist: "Wishlist",
  bubble: "Bubbles",
  concept: "Concept",
  detailed: "Detail",
  planting: "Planting",
}

// --- Bubble Diagram ---

export interface BubbleZone {
  id: string
  label: string
  cx: number // center x in cm
  cy: number // center y in cm
  rx: number // horizontal radius in cm
  ry: number // vertical radius in cm
  color: string // hex color
  rotation: number // degrees
}

export interface BubbleDiagramData {
  zones: BubbleZone[]
}

// --- Survey ---

export type SurveyElementType =
  | "house"
  | "tree"
  | "shed"
  | "fence"
  | "hedge"
  | "drain"
  | "tap"
  | "manhole"
  | "gate"
  | "path"

export const SURVEY_ELEMENT_LABELS: Record<SurveyElementType, string> = {
  house: "House",
  tree: "Tree",
  shed: "Shed",
  fence: "Fence",
  hedge: "Hedge",
  drain: "Drain",
  tap: "Tap",
  manhole: "Manhole",
  gate: "Gate",
  path: "Path",
}

export interface SurveyElement {
  id: string
  type: SurveyElementType
  x: number // top-left x in cm
  y: number // top-left y in cm
  width: number // cm
  depth: number // cm
  label: string
}

export interface SurveyBackgroundImage {
  assetPath: string // relative path in project directory (e.g. "assets/satellite.jpg")
  x: number // top-left x in cm (garden coords)
  y: number // top-left y in cm
  width: number // display width in cm
  height: number // display height in cm
  opacity: number // 0–1
}

export interface SurveyData {
  elements: SurveyElement[]
  compassAngle: number // degrees, 0 = north pointing up
  backgroundImage?: SurveyBackgroundImage
}

// --- Phase Data ---

export interface PhaseData {
  survey?: SurveyData
  wishlist?: Record<string, unknown>
  bubble?: BubbleDiagramData
  concept?: Record<string, unknown>
  detailed?: { items: GardenItem[] }
  planting?: Record<string, unknown>
}

// --- Project versions ---

export interface GardenProjectV1 {
  version: 1
  name: string
  dimensions: GardenDimensions
  gridSize: number
  items: GardenItem[]
}

export interface GardenProject {
  version: 2
  name: string
  dimensions: GardenDimensions
  gridSize: number
  activePhase: DesignPhase
  phases: PhaseData
  items: GardenItem[] // alias for phases.detailed.items
}

export type GardenProjectAny = GardenProjectV1 | GardenProject

export type ViewMode = "2d" | "3d"

export function migrateProject(raw: GardenProjectAny): GardenProject {
  if (raw.version === 2) return raw as GardenProject
  const v1 = raw as GardenProjectV1
  return {
    version: 2,
    name: v1.name,
    dimensions: v1.dimensions,
    gridSize: v1.gridSize,
    activePhase: "detailed",
    phases: {
      survey: { elements: [], compassAngle: 0 },
      detailed: { items: v1.items },
      bubble: { zones: [] },
    },
    items: v1.items,
  }
}

export function createDefaultProject(
  name: string,
  widthMeters: number,
  depthMeters: number
): GardenProject {
  return {
    version: 2,
    name,
    dimensions: {
      width: Math.round(widthMeters * 100),
      depth: Math.round(depthMeters * 100),
    },
    gridSize: 5,
    activePhase: "bubble",
    phases: {
      survey: { elements: [], compassAngle: 0 },
      detailed: { items: [] },
      bubble: { zones: [] },
    },
    items: [],
  }
}
