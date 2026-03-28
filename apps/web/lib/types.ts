export interface GardenDimensions {
  /** Width in cm */
  width: number
  /** Depth in cm */
  depth: number
}

export interface GardenItem {
  id: string
  type: DetailItemType | string
  x: number
  y: number
  width: number
  depth: number
  rotation: number
  metadata?: Record<string, unknown>
}

// --- Detail Items ---

export type DetailItemType =
  | "patio"
  | "decking"
  | "raised-bed"
  | "lawn"
  | "path"
  | "wall"
  | "pond"
  | "pergola"

export const DETAIL_ITEM_LABELS: Record<DetailItemType, string> = {
  patio: "Patio",
  decking: "Decking",
  "raised-bed": "Raised Bed",
  lawn: "Lawn",
  path: "Path",
  wall: "Wall",
  pond: "Pond",
  pergola: "Pergola",
}

export const DETAIL_ITEM_DEFAULTS: Record<DetailItemType, { w: number; d: number }> = {
  patio: { w: 300, d: 300 },
  decking: { w: 400, d: 300 },
  "raised-bed": { w: 200, d: 100 },
  lawn: { w: 400, d: 300 },
  path: { w: 100, d: 300 },
  wall: { w: 300, d: 15 },
  pond: { w: 200, d: 200 },
  pergola: { w: 300, d: 300 },
}

export const DETAIL_ITEM_COLORS: Record<DetailItemType, { fill: string; stroke: string }> = {
  patio: { fill: "#d6d3d1", stroke: "#a8a29e" },
  decking: { fill: "#c2956a", stroke: "#a47449" },
  "raised-bed": { fill: "#92400e", stroke: "#78350f" },
  lawn: { fill: "#86efac", stroke: "#4ade80" },
  path: { fill: "#e7e5e4", stroke: "#a8a29e" },
  wall: { fill: "#6b7280", stroke: "#4b5563" },
  pond: { fill: "#7dd3fc", stroke: "#38bdf8" },
  pergola: { fill: "#d4a574", stroke: "#b8864e" },
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

// --- Concept Plan ---

export interface ConceptPoint {
  x: number // cm
  y: number // cm
}

export interface ConceptShape {
  id: string
  label: string
  points: ConceptPoint[] // polygon vertices
  color: string
}

export interface ConceptPath {
  id: string
  label: string
  points: ConceptPoint[] // polyline vertices
  width: number // cm
}

export interface ConceptData {
  shapes: ConceptShape[]
  paths: ConceptPath[]
}

// --- Wishlist ---

export interface WishlistItem {
  id: string
  label: string
  checked: boolean
}

export interface WishlistCategory {
  id: string
  name: string
  items: WishlistItem[]
}

export interface WishlistData {
  categories: WishlistCategory[]
  notes: string
}

export const DEFAULT_WISHLIST: WishlistData = {
  categories: [
    {
      id: "features",
      name: "Features",
      items: [
        { id: "lawn", label: "Lawn", checked: false },
        { id: "patio", label: "Patio / Seating Area", checked: false },
        { id: "decking", label: "Decking", checked: false },
        { id: "dining", label: "Outdoor Dining", checked: false },
        { id: "play", label: "Play Area", checked: false },
        { id: "veg", label: "Vegetable Patch", checked: false },
        { id: "greenhouse", label: "Greenhouse", checked: false },
        { id: "shed", label: "Shed / Storage", checked: false },
        { id: "water", label: "Water Feature / Pond", checked: false },
        { id: "wildlife", label: "Wildlife Area", checked: false },
        { id: "fire", label: "Fire Pit / BBQ", checked: false },
        { id: "pergola", label: "Pergola / Arch", checked: false },
        { id: "raised-beds", label: "Raised Beds", checked: false },
        { id: "paths", label: "Paths", checked: false },
        { id: "lighting", label: "Garden Lighting", checked: false },
      ],
    },
    {
      id: "style",
      name: "Style",
      items: [
        { id: "formal", label: "Formal", checked: false },
        { id: "cottage", label: "Cottage", checked: false },
        { id: "modern", label: "Modern / Contemporary", checked: false },
        { id: "japanese", label: "Japanese", checked: false },
        { id: "mediterranean", label: "Mediterranean", checked: false },
        { id: "wild", label: "Wildflower / Naturalistic", checked: false },
        { id: "tropical", label: "Tropical", checked: false },
        { id: "minimal", label: "Minimal", checked: false },
      ],
    },
    {
      id: "constraints",
      name: "Constraints",
      items: [
        { id: "low-maintenance", label: "Low Maintenance", checked: false },
        { id: "budget", label: "Budget Conscious", checked: false },
        { id: "privacy", label: "Privacy / Screening", checked: false },
        { id: "children", label: "Child Friendly", checked: false },
        { id: "pets", label: "Pet Friendly", checked: false },
        { id: "accessible", label: "Accessible", checked: false },
        { id: "year-round", label: "Year-round Interest", checked: false },
        { id: "pollinators", label: "Pollinator Friendly", checked: false },
        { id: "drought", label: "Drought Tolerant", checked: false },
        { id: "shade", label: "Shade Tolerant", checked: false },
      ],
    },
  ],
  notes: "",
}

// --- Planting ---

export type PlantCategory =
  | "shrub"
  | "perennial"
  | "annual"
  | "tree"
  | "climber"
  | "grass"
  | "bulb"
  | "fern"
  | "herb"
  | "vegetable"

export type SunRequirement = "full" | "partial" | "shade"
export type WaterRequirement = "low" | "medium" | "high"
export type SoilType = "clay" | "sand" | "loam" | "chalk"
export type Season = "spring" | "summer" | "autumn" | "winter"

export interface PlantDefinition {
  id: string
  commonName: string
  botanicalName: string
  category: PlantCategory
  height: { min: number; max: number } // cm at maturity
  spread: { min: number; max: number } // cm at maturity
  sun: SunRequirement
  water: WaterRequirement
  soil: SoilType[]
  season: Season[] // seasons of interest
  evergreen: boolean
  color: string // hex — primary flower/foliage color
  notes?: string
}

export interface PlantPlacement {
  id: string
  plantId: string // references PlantDefinition.id
  x: number // center x in cm
  y: number // center y in cm
  quantity: number // default 1
}

export interface PlantingData {
  placements: PlantPlacement[]
  projectPlants: string[] // plant IDs available in project plants/ dir
  plantDefinitions?: Record<string, PlantDefinition> // inline cache of plant defs
}

// --- Phase Data ---

export interface PhaseData {
  survey?: SurveyData
  wishlist?: WishlistData
  bubble?: BubbleDiagramData
  concept?: ConceptData
  detailed?: { items: GardenItem[] }
  planting?: PlantingData
}

// --- Project versions ---

export interface GardenProjectV1 {
  version: 1
  name: string
  dimensions: GardenDimensions
  gridSize: number
  items: GardenItem[]
}

export interface CameraState {
  offsetX: number
  offsetY: number
  scale: number
}

export interface GardenProject {
  version: 2
  name: string
  dimensions: GardenDimensions
  gridSize: number
  activePhase: DesignPhase
  viewMode?: ViewMode
  camera?: CameraState
  phases: PhaseData
  items: GardenItem[] // alias for phases.detailed.items
}

export type GardenProjectAny = GardenProjectV1 | GardenProject

// --- Project Manifest (multi-version) ---

export interface DesignVersionInfo {
  id: string
  name: string
  filename: string // e.g. "designs/original.json"
  createdAt: string // ISO date
}

export interface ProjectManifest {
  name: string
  activeVersionId: string
  versions: DesignVersionInfo[]
}

export function createDefaultManifest(projectName: string): ProjectManifest {
  const id = crypto.randomUUID()
  return {
    name: projectName,
    activeVersionId: id,
    versions: [
      {
        id,
        name: "Original",
        filename: `designs/original-${id.slice(0, 8)}.json`,
        createdAt: new Date().toISOString(),
      },
    ],
  }
}

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
