"use client"

import { useProject } from "@/lib/project-store"
import { WelcomeScreen } from "./welcome-screen"
import { Toolbar } from "./toolbar"
import { ViewToggle } from "./view-toggle"
import { ProjectNameBadge } from "./project-name-badge"
import { GridView } from "./grid-view"
import { Scene3DDynamic } from "./garden-designer"

export function GardenDesignerInner() {
  const { project, viewMode } = useProject()

  if (!project) {
    return <WelcomeScreen />
  }

  return (
    <div className="relative h-svh w-full overflow-hidden">
      <Toolbar />
      <ViewToggle />
      <ProjectNameBadge />
      <div className="h-full w-full">
        {viewMode === "2d" ? <GridView /> : <Scene3DDynamic />}
      </div>
    </div>
  )
}
