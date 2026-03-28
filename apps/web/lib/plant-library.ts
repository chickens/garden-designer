import type { PlantDefinition } from "./types"

const PLANTS_DIR = "plants"

// --- Hosted library (public/plants/) ---

export async function fetchLibraryIndex(): Promise<string[]> {
  const res = await fetch("/plants/index.json")
  if (!res.ok) throw new Error("Failed to fetch plant library index")
  return res.json()
}

export async function fetchLibraryPlant(id: string): Promise<PlantDefinition> {
  const res = await fetch(`/plants/${id}/plant.json`)
  if (!res.ok) throw new Error(`Failed to fetch plant: ${id}`)
  return res.json()
}

// --- Project plants (stored in project directory) ---

export async function copyPlantToProject(
  dirHandle: FileSystemDirectoryHandle,
  plant: PlantDefinition
): Promise<void> {
  const plantsDir = await dirHandle.getDirectoryHandle(PLANTS_DIR, {
    create: true,
  })
  const plantDir = await plantsDir.getDirectoryHandle(plant.id, {
    create: true,
  })
  const fh = await plantDir.getFileHandle("plant.json", { create: true })
  const writable = await fh.createWritable()
  await writable.write(JSON.stringify(plant, null, 2))
  await writable.close()
}

export async function saveProjectPlant(
  dirHandle: FileSystemDirectoryHandle,
  plant: PlantDefinition
): Promise<void> {
  return copyPlantToProject(dirHandle, plant)
}

export async function loadProjectPlant(
  dirHandle: FileSystemDirectoryHandle,
  plantId: string
): Promise<PlantDefinition> {
  const plantsDir = await dirHandle.getDirectoryHandle(PLANTS_DIR)
  const plantDir = await plantsDir.getDirectoryHandle(plantId)
  const fh = await plantDir.getFileHandle("plant.json")
  const file = await fh.getFile()
  return JSON.parse(await file.text()) as PlantDefinition
}

export async function loadAllProjectPlants(
  dirHandle: FileSystemDirectoryHandle,
  plantIds: string[]
): Promise<PlantDefinition[]> {
  const results: PlantDefinition[] = []
  for (const id of plantIds) {
    try {
      const plant = await loadProjectPlant(dirHandle, id)
      results.push(plant)
    } catch {
      // Plant folder missing — skip
    }
  }
  return results
}
