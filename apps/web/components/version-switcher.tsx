"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { Copy, Trash2, Check, X } from "lucide-react"
import { useProject } from "@/lib/project-store"

export function VersionSwitcher() {
  const {
    manifest,
    hasDirHandle,
    save,
    switchVersion,
    duplicateVersion,
    deleteVersion,
    renameVersion,
  } = useProject()
  const [duplicating, setDuplicating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState("")

  if (!manifest || manifest.versions.length === 0) return null

  const activeId = manifest.activeVersionId

  async function handleDuplicate() {
    if (!newName.trim()) return
    setDuplicating(false)
    if (!hasDirHandle) {
      await save()
    }
    await duplicateVersion(newName.trim())
    setNewName("")
  }

  function startRename(id: string, currentName: string) {
    setEditingId(id)
    setEditName(currentName)
  }

  function commitRename() {
    if (editingId && editName.trim()) {
      renameVersion(editingId, editName.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="bg-background/80 border-border/50 fixed bottom-3 right-3 z-50 flex items-center gap-1 rounded-lg border p-1 shadow-lg backdrop-blur-xl">
      {manifest.versions.map((v) => (
        <React.Fragment key={v.id}>
          {editingId === v.id ? (
            <div className="flex items-center gap-0.5">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename()
                  if (e.key === "Escape") setEditingId(null)
                }}
                className="bg-transparent text-foreground focus:ring-ring w-20 rounded px-1 py-0.5 text-center text-xs outline-none focus:ring-1"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={commitRename}
              >
                <Check className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={v.id === activeId ? "default" : "ghost"}
                  size="sm"
                  className="px-2 text-xs"
                  onClick={() => {
                    if (v.id !== activeId) switchVersion(v.id)
                  }}
                  onDoubleClick={() => startRename(v.id, v.name)}
                >
                  {v.name}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {v.id === activeId
                  ? "Current version (double-click to rename)"
                  : "Switch to this version"}
              </TooltipContent>
            </Tooltip>
          )}
        </React.Fragment>
      ))}

      {/* Duplicate button */}
      {duplicating ? (
        <div className="flex items-center gap-0.5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDuplicate()
              if (e.key === "Escape") setDuplicating(false)
            }}
            placeholder="Version name"
            className="bg-transparent text-foreground focus:ring-ring w-24 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDuplicate}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setDuplicating(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDuplicating(true)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Duplicate current version</TooltipContent>
        </Tooltip>
      )}

      {/* Delete (only if more than 1 version) */}
      {manifest.versions.length > 1 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => deleteVersion(activeId)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete current version</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
