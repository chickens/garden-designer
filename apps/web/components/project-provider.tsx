"use client"

import * as React from "react"
import { ProjectContext, type ProjectState } from "@/lib/project-store"
import type {
  GardenProject,
  ViewMode,
  DesignPhase,
  PhaseData,
  ProjectManifest,
  CameraState,
} from "@/lib/types"
import { createDefaultProject, createDefaultManifest } from "@/lib/types"
import {
  openProjectDirectory,
  saveDesignVersion,
  saveManifest,
  loadDesignVersion,
  initProjectDirectory,
  duplicateVersion as fsDuplicateVersion,
  deleteVersion as fsDeleteVersion,
  saveAsset,
  loadAssetAsObjectUrl,
  saveToLocalStorage,
  loadFromLocalStorage,
} from "@/lib/file-system"

const MAX_HISTORY = 100

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ProjectState>({
    project: null,
    manifest: null,
    viewMode: "2d",
    isDirty: false,
    canUndo: false,
    canRedo: false,
    hasDirHandle: false,
  })
  const dirHandleRef = React.useRef<FileSystemDirectoryHandle | null>(null)

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
    (updater: (prev: ProjectState) => ProjectState) => {
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

  const resetHistory = React.useCallback(() => {
    undoStack.current = []
    redoStack.current = []
  }, [])

  // Auto-load from localStorage on mount
  React.useEffect(() => {
    const saved = loadFromLocalStorage()
    if (saved) {
      setState((s) =>
        syncHistoryFlags({
          ...s,
          project: saved,
          viewMode: saved.viewMode ?? "2d",
          manifest: s.manifest ?? createDefaultManifest(saved.name),
        })
      )
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
      const defaultManifest = createDefaultManifest(name)

      let dirHandle: FileSystemDirectoryHandle | null = null
      let manifest: ProjectManifest = defaultManifest
      try {
        const result = await initProjectDirectory(project)
        if (result) {
          dirHandle = result.dirHandle
          manifest = result.manifest
        }
      } catch {
        // User cancelled — use in-memory manifest
      }

      dirHandleRef.current = dirHandle
      resetHistory()
      setState(
        syncHistoryFlags({
          project,
          manifest,
          viewMode: "2d",
          isDirty: false,
          canUndo: false,
          canRedo: false,
          hasDirHandle: !!dirHandle,
        })
      )
    },
    [syncHistoryFlags, resetHistory]
  )

  const openProject = React.useCallback(async () => {
    try {
      const { project, manifest, dirHandle } = await openProjectDirectory()
      dirHandleRef.current = dirHandle
      resetHistory()
      setState(
        syncHistoryFlags({
          project,
          manifest,
          viewMode: project.viewMode ?? "2d",
          isDirty: false,
          canUndo: false,
          canRedo: false,
          hasDirHandle: !!dirHandle,
        })
      )
    } catch {
      // User cancelled
    }
  }, [syncHistoryFlags, resetHistory])

  const save = React.useCallback(async () => {
    if (!state.project) return
    try {
      if (dirHandleRef.current && state.manifest) {
        await saveDesignVersion(
          dirHandleRef.current,
          state.manifest,
          state.project
        )
        setState((s) => ({ ...s, isDirty: false }))
      } else {
        const result = await initProjectDirectory(state.project)
        if (result) {
          dirHandleRef.current = result.dirHandle
          setState((s) => ({
            ...s,
            manifest: result.manifest,
            isDirty: false,
            hasDirHandle: true,
          }))
        }
      }
    } catch {
      // User cancelled
    }
  }, [state.project, state.manifest])

  const saveAs = React.useCallback(async () => {
    if (!state.project) return
    try {
      const result = await initProjectDirectory(state.project)
      if (result) {
        dirHandleRef.current = result.dirHandle
        setState((s) => ({
          ...s,
          manifest: result.manifest,
          isDirty: false,
          hasDirHandle: true,
        }))
      }
    } catch {
      // User cancelled
    }
  }, [state.project])

  const updateProject = React.useCallback(
    (updates: Partial<GardenProject>) => {
      setProjectWithHistory((s) => {
        if (!s.project) return s
        return { ...s, project: { ...s.project, ...updates }, isDirty: true }
      })
    },
    [setProjectWithHistory]
  )

  const setViewMode = React.useCallback((mode: ViewMode) => {
    setState((s) => {
      if (!s.project) return { ...s, viewMode: mode }
      return {
        ...s,
        viewMode: mode,
        project: { ...s.project, viewMode: mode },
        isDirty: true,
      }
    })
  }, [])

  // Save camera without marking dirty or pushing undo — it's just viewport state
  const cameraTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const setCamera = React.useCallback((camera: CameraState) => {
    if (cameraTimerRef.current) clearTimeout(cameraTimerRef.current)
    cameraTimerRef.current = setTimeout(() => {
      setState((s) => {
        if (!s.project) return s
        return { ...s, project: { ...s.project, camera } }
      })
    }, 300) // debounce 300ms
  }, [])

  const setActivePhase = React.useCallback((phase: DesignPhase) => {
    setState((s) => {
      if (!s.project) return s
      return { ...s, project: { ...s.project, activePhase: phase } }
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
      return syncHistoryFlags({ ...s, project: prev, isDirty: true })
    })
  }, [syncHistoryFlags])

  const redo = React.useCallback(() => {
    setState((s) => {
      if (redoStack.current.length === 0 || !s.project) return s
      undoStack.current = [...undoStack.current, s.project]
      const next = redoStack.current[redoStack.current.length - 1]!
      redoStack.current = redoStack.current.slice(0, -1)
      return syncHistoryFlags({ ...s, project: next, isDirty: true })
    })
  }, [syncHistoryFlags])

  const importAsset = React.useCallback(
    async (file: File, filename: string): Promise<string | null> => {
      if (!dirHandleRef.current) return null
      return saveAsset(dirHandleRef.current, file, filename)
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

  // --- Version management ---

  const switchVersion = React.useCallback(
    async (versionId: string) => {
      if (!dirHandleRef.current || !state.manifest) return

      // Save current version first if dirty
      if (state.isDirty && state.project) {
        await saveDesignVersion(
          dirHandleRef.current,
          state.manifest,
          state.project
        )
      }

      const versionInfo = state.manifest.versions.find(
        (v) => v.id === versionId
      )
      if (!versionInfo) return

      const project = await loadDesignVersion(
        dirHandleRef.current,
        versionInfo
      )
      const updatedManifest = {
        ...state.manifest,
        activeVersionId: versionId,
      }
      await saveManifest(dirHandleRef.current, updatedManifest)

      resetHistory()
      setState(
        syncHistoryFlags({
          project,
          manifest: updatedManifest,
          viewMode: state.viewMode,
          isDirty: false,
          canUndo: false,
          canRedo: false,
          hasDirHandle: true,
        })
      )
    },
    [state.manifest, state.isDirty, state.project, state.viewMode, resetHistory, syncHistoryFlags]
  )

  const duplicateVersion = React.useCallback(
    async (newName: string) => {
      if (!dirHandleRef.current || !state.manifest) return

      // Save current first
      if (state.isDirty && state.project) {
        await saveDesignVersion(
          dirHandleRef.current,
          state.manifest,
          state.project
        )
      }

      const { manifest: updatedManifest, versionInfo } =
        await fsDuplicateVersion(
          dirHandleRef.current,
          state.manifest,
          state.manifest.activeVersionId,
          newName
        )

      // Switch to the new version
      const newManifest = {
        ...updatedManifest,
        activeVersionId: versionInfo.id,
      }
      await saveManifest(dirHandleRef.current, newManifest)

      const project = await loadDesignVersion(
        dirHandleRef.current,
        versionInfo
      )

      resetHistory()
      setState(
        syncHistoryFlags({
          project,
          manifest: newManifest,
          viewMode: state.viewMode,
          isDirty: false,
          canUndo: false,
          canRedo: false,
          hasDirHandle: true,
        })
      )
    },
    [state.manifest, state.isDirty, state.project, state.viewMode, resetHistory, syncHistoryFlags]
  )

  const deleteVersionAction = React.useCallback(
    async (versionId: string) => {
      if (!dirHandleRef.current || !state.manifest) return
      if (state.manifest.versions.length <= 1) return

      const updatedManifest = await fsDeleteVersion(
        dirHandleRef.current,
        state.manifest,
        versionId
      )

      // If we deleted the active version, load the new active one
      if (versionId === state.manifest.activeVersionId) {
        const newActive = updatedManifest.versions.find(
          (v) => v.id === updatedManifest.activeVersionId
        )!
        const project = await loadDesignVersion(
          dirHandleRef.current,
          newActive
        )
        resetHistory()
        setState(
          syncHistoryFlags({
            project,
            manifest: updatedManifest,
            viewMode: state.viewMode,
            isDirty: false,
            canUndo: false,
            canRedo: false,
            hasDirHandle: true,
          })
        )
      } else {
        setState((s) => ({ ...s, manifest: updatedManifest }))
      }
    },
    [state.manifest, state.viewMode, resetHistory, syncHistoryFlags]
  )

  const renameVersion = React.useCallback(
    (versionId: string, newName: string) => {
      if (!state.manifest) return
      const updatedManifest: ProjectManifest = {
        ...state.manifest,
        versions: state.manifest.versions.map((v) =>
          v.id === versionId ? { ...v, name: newName } : v
        ),
      }
      setState((s) => ({ ...s, manifest: updatedManifest }))
      if (dirHandleRef.current) {
        saveManifest(dirHandleRef.current, updatedManifest)
      }
    },
    [state.manifest]
  )

  // Keyboard: Ctrl+Z / Ctrl+Shift+Z
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
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
      setCamera,
      setActivePhase,
      updatePhaseData,
      undo,
      redo,
      importAsset,
      loadAssetUrl,
      switchVersion,
      duplicateVersion,
      deleteVersion: deleteVersionAction,
      renameVersion,
    }),
    [
      state,
      newProject,
      openProject,
      save,
      saveAs,
      updateProject,
      setViewMode,
      setCamera,
      setActivePhase,
      updatePhaseData,
      undo,
      redo,
      importAsset,
      loadAssetUrl,
      switchVersion,
      duplicateVersion,
      deleteVersionAction,
      renameVersion,
    ]
  )

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}
