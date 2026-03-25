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

export interface GardenProject {
  version: 1
  name: string
  dimensions: GardenDimensions
  gridSize: number
  items: GardenItem[]
}

export type ViewMode = "2d" | "3d"

export function createDefaultProject(
  name: string,
  widthMeters: number,
  depthMeters: number
): GardenProject {
  return {
    version: 1,
    name,
    dimensions: {
      width: Math.round(widthMeters * 100),
      depth: Math.round(depthMeters * 100),
    },
    gridSize: 5,
    items: [],
  }
}
