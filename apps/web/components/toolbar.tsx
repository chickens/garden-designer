"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { Separator } from "@workspace/ui/components/separator"
import { FilePlus, FolderOpen, Save, Undo2, Redo2 } from "lucide-react"
import { useProject } from "@/lib/project-store"
import { NewProjectDialog } from "./new-project-dialog"

export function Toolbar() {
  const { newProject, openProject, save, undo, redo, canUndo, canRedo } =
    useProject()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [save])

  return (
    <>
      <div className="bg-background/80 border-border/50 fixed left-3 top-3 z-50 flex items-center gap-1 rounded-lg border p-1 shadow-lg backdrop-blur-xl">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDialogOpen(true)}
            >
              <FilePlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Project</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => openProject()}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Project</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Undo <kbd className="ml-1 text-xs opacity-60">Ctrl+Z</kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!canRedo}
              onClick={redo}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Redo{" "}
            <kbd className="ml-1 text-xs opacity-60">Ctrl+Shift+Z</kbd>
          </TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => save()}>
              <Save className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Save <kbd className="ml-1 text-xs opacity-60">Ctrl+S</kbd>
          </TooltipContent>
        </Tooltip>
      </div>
      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={newProject}
      />
    </>
  )
}
