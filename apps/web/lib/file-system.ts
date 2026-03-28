import type {
  GardenProject,
  GardenProjectAny,
  ProjectManifest,
  DesignVersionInfo,
} from "./types"
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
const MANIFEST_FILE = "project.json"
const DESIGNS_DIR = "designs"
const ASSETS_DIR = "assets"

// --- Helper: read/write JSON in a directory ---

async function readJsonFile<T>(
  dirHandle: FileSystemDirectoryHandle,
  path: string
): Promise<T> {
  const parts = path.split("/")
  let dir = dirHandle
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]!)
  }
  const fh = await dir.getFileHandle(parts[parts.length - 1]!)
  const file = await fh.getFile()
  return JSON.parse(await file.text()) as T
}

async function writeJsonFile(
  dirHandle: FileSystemDirectoryHandle,
  path: string,
  data: unknown
): Promise<void> {
  const parts = path.split("/")
  let dir = dirHandle
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]!, { create: true })
  }
  const fh = await dir.getFileHandle(parts[parts.length - 1]!, { create: true })
  const writable = await fh.createWritable()
  await writable.write(JSON.stringify(data, null, 2))
  await writable.close()
}

// --- Manifest operations ---

function createManifest(projectName: string, firstVersion: DesignVersionInfo): ProjectManifest {
  return {
    name: projectName,
    activeVersionId: firstVersion.id,
    versions: [firstVersion],
  }
}

function createVersionInfo(name: string): DesignVersionInfo {
  const id = crypto.randomUUID()
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")
  return {
    id,
    name,
    filename: `${DESIGNS_DIR}/${slug}-${id.slice(0, 8)}.json`,
    createdAt: new Date().toISOString(),
  }
}

// --- Directory-based project format ---

export interface OpenResult {
  project: GardenProject
  manifest: ProjectManifest
  dirHandle: FileSystemDirectoryHandle | null
}

export async function openProjectDirectory(): Promise<OpenResult> {
  if (window.showDirectoryPicker) {
    const dirHandle = await window.showDirectoryPicker({
      id: "garden-project",
      mode: "readwrite",
    })

    let manifest: ProjectManifest
    try {
      manifest = await readJsonFile<ProjectManifest>(dirHandle, MANIFEST_FILE)
    } catch {
      // Legacy: no manifest — try reading project.json as a design file
      const raw = await readJsonFile<GardenProjectAny>(dirHandle, MANIFEST_FILE)
      const project = migrateProject(raw)
      const versionInfo = createVersionInfo("Original")
      manifest = createManifest(project.name, versionInfo)
      // Migrate: write the design to designs/ and rewrite manifest
      await dirHandle.getDirectoryHandle(DESIGNS_DIR, { create: true })
      await writeJsonFile(dirHandle, versionInfo.filename, project)
      await writeJsonFile(dirHandle, MANIFEST_FILE, manifest)
      return { project, manifest, dirHandle }
    }

    const activeVersion = manifest.versions.find(
      (v) => v.id === manifest.activeVersionId
    )
    if (!activeVersion) throw new Error("Active version not found in manifest")

    const raw = await readJsonFile<GardenProjectAny>(dirHandle, activeVersion.filename)
    const project = migrateProject(raw)
    return { project, manifest, dirHandle }
  }

  // Fallback: single JSON file
  return new Promise((resolve, reject) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error("No file selected"))
      const text = await file.text()
      const project = migrateProject(JSON.parse(text) as GardenProjectAny)
      const versionInfo = createVersionInfo("Original")
      const manifest = createManifest(project.name, versionInfo)
      resolve({ project, manifest, dirHandle: null })
    }
    input.oncancel = () => reject(new Error("Cancelled"))
    input.click()
  })
}

export async function saveDesignVersion(
  dirHandle: FileSystemDirectoryHandle,
  manifest: ProjectManifest,
  project: GardenProject
): Promise<void> {
  const activeVersion = manifest.versions.find(
    (v) => v.id === manifest.activeVersionId
  )
  if (!activeVersion) throw new Error("Active version not found")
  await writeJsonFile(dirHandle, activeVersion.filename, project)
  await writeJsonFile(dirHandle, MANIFEST_FILE, manifest)
}

export async function saveManifest(
  dirHandle: FileSystemDirectoryHandle,
  manifest: ProjectManifest
): Promise<void> {
  await writeJsonFile(dirHandle, MANIFEST_FILE, manifest)
}

export async function loadDesignVersion(
  dirHandle: FileSystemDirectoryHandle,
  versionInfo: DesignVersionInfo
): Promise<GardenProject> {
  const raw = await readJsonFile<GardenProjectAny>(dirHandle, versionInfo.filename)
  return migrateProject(raw)
}

export async function initProjectDirectory(
  project: GardenProject
): Promise<{ dirHandle: FileSystemDirectoryHandle; manifest: ProjectManifest } | null> {
  if (window.showDirectoryPicker) {
    const dirHandle = await window.showDirectoryPicker({
      id: "garden-project",
      mode: "readwrite",
    })
    await dirHandle.getDirectoryHandle(ASSETS_DIR, { create: true })
    await dirHandle.getDirectoryHandle(DESIGNS_DIR, { create: true })

    const versionInfo = createVersionInfo("Original")
    const manifest = createManifest(project.name, versionInfo)

    await writeJsonFile(dirHandle, versionInfo.filename, project)
    await writeJsonFile(dirHandle, MANIFEST_FILE, manifest)

    return { dirHandle, manifest }
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

export async function duplicateVersion(
  dirHandle: FileSystemDirectoryHandle,
  manifest: ProjectManifest,
  sourceVersionId: string,
  newName: string
): Promise<{ manifest: ProjectManifest; versionInfo: DesignVersionInfo }> {
  const source = manifest.versions.find((v) => v.id === sourceVersionId)
  if (!source) throw new Error("Source version not found")

  const project = await loadDesignVersion(dirHandle, source)
  const versionInfo = createVersionInfo(newName)

  await writeJsonFile(dirHandle, versionInfo.filename, project)

  const updatedManifest: ProjectManifest = {
    ...manifest,
    versions: [...manifest.versions, versionInfo],
  }
  await writeJsonFile(dirHandle, MANIFEST_FILE, updatedManifest)

  return { manifest: updatedManifest, versionInfo }
}

export async function deleteVersion(
  dirHandle: FileSystemDirectoryHandle,
  manifest: ProjectManifest,
  versionId: string
): Promise<ProjectManifest> {
  const version = manifest.versions.find((v) => v.id === versionId)
  if (!version) throw new Error("Version not found")
  if (manifest.versions.length <= 1) throw new Error("Cannot delete last version")

  // Remove the file
  const parts = version.filename.split("/")
  let dir: FileSystemDirectoryHandle = dirHandle
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]!)
  }
  await dir.removeEntry(parts[parts.length - 1]!)

  const remaining = manifest.versions.filter((v) => v.id !== versionId)
  const updatedManifest: ProjectManifest = {
    ...manifest,
    versions: remaining,
    activeVersionId:
      manifest.activeVersionId === versionId
        ? remaining[0]!.id
        : manifest.activeVersionId,
  }
  await writeJsonFile(dirHandle, MANIFEST_FILE, updatedManifest)
  return updatedManifest
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
