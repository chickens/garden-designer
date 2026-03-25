"use client"

import * as React from "react"
import { ProjectContext, type ProjectState } from "@/lib/project-store"
import type { GardenProject, ViewMode } from "@/lib/types"
import { createDefaultProject } from "@/lib/types"
import {
  openProjectFile,
  saveProjectFile,
  saveProjectFileAs,
  saveToLocalStorage,
  loadFromLocalStorage,
} from "@/lib/file-system"

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ProjectState>({
    project: null,
    viewMode: "2d",
    isDirty: false,
  })
  const fileHandleRef = React.useRef<FileSystemFileHandle | null>(null)

  // Auto-load from localStorage on mount
  React.useEffect(() => {
    const saved = loadFromLocalStorage()
    if (saved) {
      setState((s) => ({ ...s, project: saved }))
    }
  }, [])

  // Auto-save to localStorage on project change
  React.useEffect(() => {
    if (state.project) {
      saveToLocalStorage(state.project)
    }
  }, [state.project])

  const newProject = React.useCallback(
    (name: string, widthMeters: number, depthMeters: number) => {
      const project = createDefaultProject(name, widthMeters, depthMeters)
      fileHandleRef.current = null
      setState({ project, viewMode: "2d", isDirty: false })
    },
    []
  )

  const openProject = React.useCallback(async () => {
    try {
      const { project, handle } = await openProjectFile()
      fileHandleRef.current = handle
      setState({ project, viewMode: "2d", isDirty: false })
    } catch {
      // User cancelled or error
    }
  }, [])

  const save = React.useCallback(async () => {
    if (!state.project) return
    try {
      if (fileHandleRef.current) {
        await saveProjectFile(state.project, fileHandleRef.current)
        setState((s) => ({ ...s, isDirty: false }))
      } else {
        const handle = await saveProjectFileAs(state.project)
        if (handle) {
          fileHandleRef.current = handle
          setState((s) => ({ ...s, isDirty: false }))
        }
      }
    } catch {
      // User cancelled or error
    }
  }, [state.project])

  const saveAs = React.useCallback(async () => {
    if (!state.project) return
    try {
      const handle = await saveProjectFileAs(state.project)
      if (handle) {
        fileHandleRef.current = handle
        setState((s) => ({ ...s, isDirty: false }))
      }
    } catch {
      // User cancelled or error
    }
  }, [state.project])

  const updateProject = React.useCallback(
    (updates: Partial<GardenProject>) => {
      setState((s) => {
        if (!s.project) return s
        return {
          ...s,
          project: { ...s.project, ...updates },
          isDirty: true,
        }
      })
    },
    []
  )

  const setViewMode = React.useCallback((mode: ViewMode) => {
    setState((s) => ({ ...s, viewMode: mode }))
  }, [])

  const value = React.useMemo(
    () => ({
      ...state,
      newProject,
      openProject,
      save,
      saveAs,
      updateProject,
      setViewMode,
    }),
    [state, newProject, openProject, save, saveAs, updateProject, setViewMode]
  )

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}
