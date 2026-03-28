"use client"

import * as React from "react"
import type { GardenProject } from "./types"

interface Transform {
  offsetX: number
  offsetY: number
  scale: number
}

/**
 * Shared hook for canvas camera management.
 * Restores saved camera position on mount, or centers the garden if none saved.
 * Call `saveCamera()` after pan/zoom to persist.
 */
export function useCanvasCamera(
  containerRef: React.RefObject<HTMLDivElement | null>,
  transformRef: React.MutableRefObject<Transform>,
  project: GardenProject | null,
  setCamera: (camera: Transform) => void,
  draw: () => void
) {
  const initializedRef = React.useRef(false)

  // Initialize camera: restore saved or center
  const dimsKey = project
    ? `${project.dimensions.width}x${project.dimensions.depth}`
    : ""

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || !project) return

    // If we have a saved camera, restore it
    if (project.camera && !initializedRef.current) {
      transformRef.current = { ...project.camera }
      initializedRef.current = true
      draw()
      return
    }

    // Otherwise center the garden
    const rect = container.getBoundingClientRect()
    const { width: gardenW, depth: gardenD } = project.dimensions
    const padding = 80
    const scaleX = (rect.width - padding * 2) / gardenW
    const scaleY = (rect.height - padding * 2) / gardenD
    const s = Math.min(scaleX, scaleY)

    transformRef.current = {
      scale: s,
      offsetX: (rect.width - gardenW * s) / 2,
      offsetY: (rect.height - gardenD * s) / 2,
    }
    initializedRef.current = true
    draw()
  }, [dimsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save camera state (debounced in the provider)
  const saveCamera = React.useCallback(() => {
    setCamera({ ...transformRef.current })
  }, [setCamera, transformRef])

  return { saveCamera }
}
