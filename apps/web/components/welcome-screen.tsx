"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import { Flower2, FolderOpen } from "lucide-react"
import { NewProjectDialog } from "./new-project-dialog"
import { useProject } from "@/lib/project-store"

export function WelcomeScreen() {
  const { newProject, openProject } = useProject()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  return (
    <div className="flex h-svh w-full items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <Flower2 className="text-muted-foreground h-12 w-12" strokeWidth={1.5} />
          <h1 className="text-2xl font-semibold tracking-tight">
            Garden Designer
          </h1>
          <p className="text-muted-foreground text-sm">
            Design your garden in 2D and 3D
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => openProject()}
            className="gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            Open Project
          </Button>
          <Button
            size="lg"
            onClick={() => setDialogOpen(true)}
            className="gap-2"
          >
            <Flower2 className="h-4 w-4" />
            New Garden
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Press <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">d</kbd> to toggle dark mode
        </p>
      </div>
      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={newProject}
      />
    </div>
  )
}
