"use client"

import * as React from "react"
import { ProjectContext, type ProjectState } from "@/lib/project-store"
import type { GardenProject, ViewMode, DesignPhase, PhaseData } from "@/lib/types"
import { createDefaultProject } from "@/lib/types"
import {
  openProjectDirectory,
  saveProjectToDirectory,
  saveProjectNewDirectory,
  saveAsset,
  loadAssetAsObjectUrl,
  saveToLocalStorage,
  loadFromLocalStorage,
} from "@/lib/file-system"

const MAX_HISTORY = 100

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ProjectState>({
    project: null,
    viewMode: "2d",
    isDirty: false,
    canUndo: false,
    canRedo: false,
    hasDirHandle: false,
  })
  const dirHandleRef = React.useRef<FileSystemDirectoryHandle | null>(null)

  // History stacks
  const undoStack = React.useRef<GardenProject[]>([])
  const redoStack = React.useRef<GardenProject[]>([])

  const pushUndo = React.useCallback((project: GardenProject) => {
    undoStack.current = [...undoStack.current.slice(-(MAX_HISTORY - 1)), project]
    redoStack.current = []
  }, [])

  const syncHistoryFlags = React.useCallback(
    (s: ProjectState): ProjectState => ({
      ...s,
      canUndo: undoStack.current.length > 0,
      canRedo: redoStack.current.length > 0,
    }),
    []
  )

  const setProjectWithHistory = React.useCallback(
    (
      updater: (prev: ProjectState) => ProjectState
    ) => {
      setState((s) => {
        const next = updater(s)
        if (s.project && next.isDirty) {
          pushUndo(s.project)
        }
        return syncHistoryFlags(next)
      })
    },
    [pushUndo, syncHistoryFlags]
  )

  // Auto-load from localStorage on mount
  React.useEffect(() => {
    const saved = loadFromLocalStorage()
    if (saved) {
      setState((s) => syncHistoryFlags({ ...s, project: saved }))
    }
  }, [syncHistoryFlags])

  // Auto-save to localStorage on project change
  React.useEffect(() => {
    if (state.project) {
      saveToLocalStorage(state.project)
    }
  }, [state.project])

  const newProject = React.useCallback(
    async (name: string, widthMeters: number, depthMeters: number) => {
      const project = createDefaultProject(name, widthMeters, depthMeters)

      // Prompt for project folder immediately
      let dirHandle: FileSystemDirectoryHandle | null = null
      try {
        dirHandle = await saveProjectNewDirectory(project)
      } catch {
        // User cancelled — still create the project in memory
      }

      dirHandleRef.current = dirHandle
      undoStack.current = []
      redoStack.current = []
      setState(
        syncHistoryFlags({
          project,
          viewMode: "2d",
          isDirty: false,
          canUndo: false,
          canRedo: false,
          hasDirHandle: !!dirHandle,
        })
      )
    },
    [syncHistoryFlags]
  )

  const openProject = React.useCallback(async () => {
    try {
      const { project, dirHandle } = await openProjectDirectory()
      dirHandleRef.current = dirHandle
      undoStack.current = []
      redoStack.current = []
      setState(
        syncHistoryFlags({
          project,
          viewMode: "2d",
          isDirty: false,
          canUndo: false,
          canRedo: false,
          hasDirHandle: !!dirHandle,
        })
      )
    } catch {
      // User cancelled or error
    }
  }, [syncHistoryFlags])

  const save = React.useCallback(async () => {
    if (!state.project) return
    try {
      if (dirHandleRef.current) {
        await saveProjectToDirectory(state.project, dirHandleRef.current)
        setState((s) => ({ ...s, isDirty: false }))
      } else {
        const dirHandle = await saveProjectNewDirectory(state.project)
        if (dirHandle) {
          dirHandleRef.current = dirHandle
          setState((s) => ({ ...s, isDirty: false, hasDirHandle: true }))
        }
      }
    } catch {
      // User cancelled or error
    }
  }, [state.project])

  const saveAs = React.useCallback(async () => {
    if (!state.project) return
    try {
      const dirHandle = await saveProjectNewDirectory(state.project)
      if (dirHandle) {
        dirHandleRef.current = dirHandle
        setState((s) => ({ ...s, isDirty: false, hasDirHandle: true }))
      }
    } catch {
      // User cancelled or error
    }
  }, [state.project])

  const updateProject = React.useCallback(
    (updates: Partial<GardenProject>) => {
      setProjectWithHistory((s) => {
        if (!s.project) return s
        return {
          ...s,
          project: { ...s.project, ...updates },
          isDirty: true,
        }
      })
    },
    [setProjectWithHistory]
  )

  const setViewMode = React.useCallback((mode: ViewMode) => {
    setState((s) => ({ ...s, viewMode: mode }))
  }, [])

  const setActivePhase = React.useCallback((phase: DesignPhase) => {
    setState((s) => {
      if (!s.project) return s
      return {
        ...s,
        project: { ...s.project, activePhase: phase },
      }
    })
  }, [])

  const updatePhaseData = React.useCallback(
    <K extends keyof PhaseData>(phase: K, data: PhaseData[K]) => {
      setProjectWithHistory((s) => {
        if (!s.project) return s
        const updatedPhases = { ...s.project.phases, [phase]: data }
        const updatedItems = updatedPhases.detailed?.items ?? s.project.items
        return {
          ...s,
          project: {
            ...s.project,
            phases: updatedPhases,
            items: updatedItems,
          },
          isDirty: true,
        }
      })
    },
    [setProjectWithHistory]
  )

  const undo = React.useCallback(() => {
    setState((s) => {
      if (undoStack.current.length === 0 || !s.project) return s
      redoStack.current = [...redoStack.current, s.project]
      const prev = undoStack.current[undoStack.current.length - 1]!
      undoStack.current = undoStack.current.slice(0, -1)
      return syncHistoryFlags({
        ...s,
        project: prev,
        isDirty: true,
      })
    })
  }, [syncHistoryFlags])

  const redo = React.useCallback(() => {
    setState((s) => {
      if (redoStack.current.length === 0 || !s.project) return s
      undoStack.current = [...undoStack.current, s.project]
      const next = redoStack.current[redoStack.current.length - 1]!
      redoStack.current = redoStack.current.slice(0, -1)
      return syncHistoryFlags({
        ...s,
        project: next,
        isDirty: true,
      })
    })
  }, [syncHistoryFlags])

  const importAsset = React.useCallback(
    async (file: File, filename: string): Promise<string | null> => {
      if (!dirHandleRef.current) {
        // No directory — prompt user to save project first, or return data URL fallback
        return null
      }
      const assetPath = await saveAsset(dirHandleRef.current, file, filename)
      return assetPath
    },
    []
  )

  const loadAssetUrl = React.useCallback(
    async (assetPath: string): Promise<string | null> => {
      if (!dirHandleRef.current) return null
      try {
        return await loadAssetAsObjectUrl(dirHandleRef.current, assetPath)
      } catch {
        return null
      }
    },
    []
  )

  // Global keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return
      e.preventDefault()
      if (e.shiftKey) {
        redo()
      } else {
        undo()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [undo, redo])

  const value = React.useMemo(
    () => ({
      ...state,
      newProject,
      openProject,
      save,
      saveAs,
      updateProject,
      setViewMode,
      setActivePhase,
      updatePhaseData,
      undo,
      redo,
      importAsset,
      loadAssetUrl,
    }),
    [
      state,
      newProject,
      openProject,
      save,
      saveAs,
      updateProject,
      setViewMode,
      setActivePhase,
      updatePhaseData,
      undo,
      redo,
      importAsset,
      loadAssetUrl,
    ]
  )

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}
