// Clipboard utility for copy/paste across canvas phases.
// Uses the browser clipboard with a JSON payload.
// Works across project versions since it's serialized data.

const CLIPBOARD_PREFIX = "garden-designer:"

export interface ClipboardPayload {
  phase: string
  items: unknown[]
}

export async function copyToClipboard(
  phase: string,
  items: unknown[]
): Promise<void> {
  const payload: ClipboardPayload = { phase, items }
  const json = CLIPBOARD_PREFIX + JSON.stringify(payload)
  await navigator.clipboard.writeText(json)
}

export async function pasteFromClipboard(): Promise<ClipboardPayload | null> {
  try {
    const text = await navigator.clipboard.readText()
    if (!text.startsWith(CLIPBOARD_PREFIX)) return null
    const json = text.slice(CLIPBOARD_PREFIX.length)
    return JSON.parse(json) as ClipboardPayload
  } catch {
    return null
  }
}

// Offset pasted items slightly so they don't land exactly on top of originals
const PASTE_OFFSET = 20 // cm

export function offsetItem<T extends { x: number; y: number }>(
  item: T
): T {
  return { ...item, x: item.x + PASTE_OFFSET, y: item.y + PASTE_OFFSET }
}

export function offsetItemCenter<T extends { cx: number; cy: number }>(
  item: T
): T {
  return { ...item, cx: item.cx + PASTE_OFFSET, cy: item.cy + PASTE_OFFSET }
}
