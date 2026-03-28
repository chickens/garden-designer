"use client"

import { createContext, useContext } from "react"
import type {
  GardenProject,
  ViewMode,
  DesignPhase,
  PhaseData,
  ProjectManifest,
  DesignVersionInfo,
  CameraState,
  Camera3DState,
} from "./types"

export interface ProjectState {
  project: GardenProject | null
  manifest: ProjectManifest | null
  viewMode: ViewMode
  isDirty: boolean
  canUndo: boolean
  canRedo: boolean
  hasDirHandle: boolean
}

export interface ProjectActions {
  newProject: (name: string, widthMeters: number, depthMeters: number) => Promise<void>
  openProject: () => Promise<void>
  save: () => Promise<void>
  saveAs: () => Promise<void>
  updateProject: (updates: Partial<GardenProject>) => void
  setViewMode: (mode: ViewMode) => void
  setActivePhase: (phase: DesignPhase) => void
  updatePhaseData: <K extends keyof PhaseData>(
    phase: K,
    data: PhaseData[K]
  ) => void
  undo: () => void
  redo: () => void
  importAsset: (file: File, filename: string) => Promise<string | null>
  loadAssetUrl: (assetPath: string) => Promise<string | null>
  getPlantTexture: (plantId: string, plantName: string, botanicalName: string, notes?: string) => Promise<string | null>
  loadPlantTexture: (plantId: string) => Promise<string | null>
  setCamera: (camera: CameraState) => void
  setCamera3d: (camera: Camera3DState) => void
  // Version management
  switchVersion: (versionId: string) => Promise<void>
  duplicateVersion: (newName: string) => Promise<void>
  deleteVersion: (versionId: string) => Promise<void>
  renameVersion: (versionId: string, newName: string) => void
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
