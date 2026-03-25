"use client"

import { createContext, useContext } from "react"
import type { GardenProject, ViewMode } from "./types"

export interface ProjectState {
  project: GardenProject | null
  viewMode: ViewMode
  isDirty: boolean
}

export interface ProjectActions {
  newProject: (name: string, widthMeters: number, depthMeters: number) => void
  openProject: () => Promise<void>
  save: () => Promise<void>
  saveAs: () => Promise<void>
  updateProject: (updates: Partial<GardenProject>) => void
  setViewMode: (mode: ViewMode) => void
}

export type ProjectContextValue = ProjectState & ProjectActions

export const ProjectContext = createContext<ProjectContextValue | null>(null)

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) {
    throw new Error("useProject must be used within a ProjectProvider")
  }
  return ctx
}
