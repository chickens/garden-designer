"use client"

import dynamic from "next/dynamic"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { ProjectProvider } from "./project-provider"
import { GardenDesignerInner } from "./garden-designer-inner"

const Scene3DDynamic = dynamic(
  () => import("./scene-3d").then((m) => ({ default: m.Scene3D })),
  { ssr: false }
)

export { Scene3DDynamic }

export function GardenDesigner() {
  return (
    <TooltipProvider delayDuration={300}>
      <ProjectProvider>
        <GardenDesignerInner />
      </ProjectProvider>
    </TooltipProvider>
  )
}
