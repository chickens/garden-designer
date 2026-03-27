import type { GardenProject, GardenProjectAny } from "./types"
import { migrateProject } from "./types"

declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      types?: { description: string; accept: Record<string, string[]> }[]
      multiple?: boolean
    }) => Promise<FileSystemFileHandle[]>
    showSaveFilePicker?: (options?: {
      types?: { description: string; accept: Record<string, string[]> }[]
      suggestedName?: string
    }) => Promise<FileSystemFileHandle>
    showDirectoryPicker?: (options?: {
      id?: string
      mode?: "read" | "readwrite"
      startIn?: string
    }) => Promise<FileSystemDirectoryHandle>
  }
}

const STORAGE_KEY = "garden-designer-project"
const PROJECT_FILE = "project.json"
const ASSETS_DIR = "assets"

// --- Directory-based project format ---

export async function openProjectDirectory(): Promise<{
  project: GardenProject
  dirHandle: FileSystemDirectoryHandle | null
}> {
  if (window.showDirectoryPicker) {
    const dirHandle = await window.showDirectoryPicker({
      id: "garden-project",
      mode: "readwrite",
    })
    const fileHandle = await dirHandle.getFileHandle(PROJECT_FILE)
    const file = await fileHandle.getFile()
    const text = await file.text()
    const project = migrateProject(JSON.parse(text) as GardenProjectAny)
    return { project, dirHandle }
  }

  // Fallback: single JSON file via file input
  return new Promise((resolve, reject) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error("No file selected"))
      const text = await file.text()
      const project = migrateProject(JSON.parse(text) as GardenProjectAny)
      resolve({ project, dirHandle: null })
    }
    input.oncancel = () => reject(new Error("Cancelled"))
    input.click()
  })
}

export async function saveProjectToDirectory(
  project: GardenProject,
  dirHandle: FileSystemDirectoryHandle
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(PROJECT_FILE, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(JSON.stringify(project, null, 2))
  await writable.close()
}

export async function saveProjectNewDirectory(
  project: GardenProject
): Promise<FileSystemDirectoryHandle | null> {
  if (window.showDirectoryPicker) {
    const dirHandle = await window.showDirectoryPicker({
      id: "garden-project",
      mode: "readwrite",
    })
    // Create assets directory
    await dirHandle.getDirectoryHandle(ASSETS_DIR, { create: true })
    await saveProjectToDirectory(project, dirHandle)
    return dirHandle
  }

  // Fallback: download as single JSON
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${project.name.toLowerCase().replace(/\s+/g, "-")}.project.json`
  a.click()
  URL.revokeObjectURL(url)
  return null
}

// --- Asset management ---

export async function saveAsset(
  dirHandle: FileSystemDirectoryHandle,
  file: File,
  filename: string
): Promise<string> {
  const assetsDir = await dirHandle.getDirectoryHandle(ASSETS_DIR, { create: true })
  const fileHandle = await assetsDir.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(file)
  await writable.close()
  return `${ASSETS_DIR}/${filename}`
}

export async function loadAssetAsObjectUrl(
  dirHandle: FileSystemDirectoryHandle,
  assetPath: string
): Promise<string> {
  const parts = assetPath.split("/")
  let currentDir: FileSystemDirectoryHandle = dirHandle
  // Navigate to subdirectories
  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i]!)
  }
  const fileHandle = await currentDir.getFileHandle(parts[parts.length - 1]!)
  const file = await fileHandle.getFile()
  return URL.createObjectURL(file)
}

// --- localStorage backup ---

export function saveToLocalStorage(project: GardenProject): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  } catch {
    // Storage full or unavailable
  }
}

export function loadFromLocalStorage(): GardenProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return migrateProject(JSON.parse(raw) as GardenProjectAny)
  } catch {
    return null
  }
}

export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
