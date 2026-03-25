import type { GardenProject } from "./types"

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
  }
}

const STORAGE_KEY = "garden-designer-project"
const FILE_TYPES = [
  {
    description: "Garden Project",
    accept: { "application/json": [".garden.json"] },
  },
]

// --- File System Access API ---

export async function openProjectFile(): Promise<{
  project: GardenProject
  handle: FileSystemFileHandle | null
}> {
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      types: FILE_TYPES,
      multiple: false,
    })
    if (!handle) throw new Error("No file selected")
    const file = await handle.getFile()
    const text = await file.text()
    const project = JSON.parse(text) as GardenProject
    return { project, handle: handle ?? null }
  }

  // Fallback: hidden file input
  return new Promise((resolve, reject) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".garden.json,.json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error("No file selected"))
      const text = await file.text()
      const project = JSON.parse(text) as GardenProject
      resolve({ project, handle: null })
    }
    input.oncancel = () => reject(new Error("Cancelled"))
    input.click()
  })
}

export async function saveProjectFile(
  project: GardenProject,
  handle: FileSystemFileHandle
): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(JSON.stringify(project, null, 2))
  await writable.close()
}

export async function saveProjectFileAs(
  project: GardenProject
): Promise<FileSystemFileHandle | null> {
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      types: FILE_TYPES,
      suggestedName: `${project.name.toLowerCase().replace(/\s+/g, "-")}.garden.json`,
    })
    await saveProjectFile(project, handle)
    return handle
  }

  // Fallback: download via blob
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${project.name.toLowerCase().replace(/\s+/g, "-")}.garden.json`
  a.click()
  URL.revokeObjectURL(url)
  return null
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
    return JSON.parse(raw) as GardenProject
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
