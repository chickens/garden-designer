"use client"

import { useProject } from "@/lib/project-store"
import { WelcomeScreen } from "./welcome-screen"
import { Toolbar } from "./toolbar"
import { ViewToggle } from "./view-toggle"
import { PhaseNav } from "./phase-nav"
import { PhaseToolbar } from "./phase-toolbar"
import { ProjectNameBadge } from "./project-name-badge"
import { PhaseCanvas } from "./phase-canvas"
import { Scene3DDynamic } from "./garden-designer"

export function GardenDesignerInner() {
  const { project, viewMode } = useProject()

  if (!project) {
    return <WelcomeScreen />
  }

  return (
    <div className="relative h-svh w-full overflow-hidden">
      <Toolbar />
      <PhaseNav />
      <ViewToggle />
      <PhaseToolbar />
      <ProjectNameBadge />
      <div className="h-full w-full">
        {viewMode === "3d" ? (
          <Scene3DDynamic />
        ) : (
          <PhaseCanvas phase={project.activePhase} />
        )}
      </div>
    </div>
  )
}
