// Manages plant texture generation and caching.
// Textures are stored as texture.png inside each plant's folder:
//   plants/{plantId}/texture.png
// On first request, checks the project directory for an existing texture.
// If none, generates one via the API and saves it to the plant folder.

const PLANTS_DIR = "plants"
const TEXTURE_FILE = "texture.png"

const urlCache = new Map<string, string>()
const pendingRequests = new Map<string, Promise<string | null>>()

export function getCachedTextureUrl(plantId: string): string | null {
  return urlCache.get(plantId) ?? null
}

/** Try to load an existing texture from the project's plant folder */
export async function loadTextureFromProject(
  dirHandle: FileSystemDirectoryHandle,
  plantId: string
): Promise<string | null> {
  // Return cached
  if (urlCache.has(plantId)) return urlCache.get(plantId)!

  try {
    const plantsDir = await dirHandle.getDirectoryHandle(PLANTS_DIR)
    const plantDir = await plantsDir.getDirectoryHandle(plantId)
    const fh = await plantDir.getFileHandle(TEXTURE_FILE)
    const file = await fh.getFile()
    const url = URL.createObjectURL(file)
    urlCache.set(plantId, url)
    return url
  } catch {
    return null
  }
}

/** Save a texture PNG to the project's plant folder */
async function saveTextureToProject(
  dirHandle: FileSystemDirectoryHandle,
  plantId: string,
  pngBlob: Blob
): Promise<void> {
  const plantsDir = await dirHandle.getDirectoryHandle(PLANTS_DIR, { create: true })
  const plantDir = await plantsDir.getDirectoryHandle(plantId, { create: true })
  const fh = await plantDir.getFileHandle(TEXTURE_FILE, { create: true })
  const writable = await fh.createWritable()
  await writable.write(pngBlob)
  await writable.close()
}

/**
 * Get or generate a plant texture.
 * 1. Check URL cache
 * 2. Check project directory for existing texture.png
 * 3. Generate via API, save to project, return URL
 */
export async function getOrGenerateTexture(
  plantId: string,
  plantName: string,
  botanicalName: string,
  dirHandle: FileSystemDirectoryHandle | null,
  notes?: string
): Promise<string | null> {
  // Return cached URL
  if (urlCache.has(plantId)) return urlCache.get(plantId)!

  // Deduplicate concurrent requests
  if (pendingRequests.has(plantId)) return pendingRequests.get(plantId)!

  const promise = (async () => {
    try {
      // Try loading from project directory first
      if (dirHandle) {
        const existing = await loadTextureFromProject(dirHandle, plantId)
        if (existing) return existing
      }

      // Generate via API
      const res = await fetch("/api/generate-texture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantName, botanicalName, notes }),
      })

      if (!res.ok) return null

      const { image } = await res.json()
      if (!image) return null

      // Decode base64 to blob
      const imgRes = await fetch(`data:image/png;base64,${image}`)
      const blob = await imgRes.blob()

      // Save to project directory
      if (dirHandle) {
        await saveTextureToProject(dirHandle, plantId, blob)
      }
      const url = URL.createObjectURL(blob)
      urlCache.set(plantId, url)
      return url
    } catch {
      return null
    } finally {
      pendingRequests.delete(plantId)
    }
  })()

  pendingRequests.set(plantId, promise)
  return promise
}
