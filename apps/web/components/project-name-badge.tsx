"use client"

import { useProject } from "@/lib/project-store"

export function ProjectNameBadge() {
  const { project, isDirty } = useProject()
  if (!project) return null

  const widthM = (project.dimensions.width / 100).toFixed(1)
  const depthM = (project.dimensions.depth / 100).toFixed(1)

  return (
    <div className="bg-background/80 border-border/50 fixed bottom-3 left-3 z-50 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm shadow-lg backdrop-blur-xl">
      <span className="font-medium">
        {project.name}
        {isDirty && <span className="text-muted-foreground ml-1">*</span>}
      </span>
      <span className="text-muted-foreground text-xs">
        {widthM} x {depthM} m
      </span>
    </div>
  )
}
