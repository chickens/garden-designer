"use client"

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { Grid2x2, Box } from "lucide-react"
import { useProject } from "@/lib/project-store"
import type { ViewMode } from "@/lib/types"

export function ViewToggle() {
  const { viewMode, setViewMode } = useProject()

  return (
    <div className="bg-background/80 border-border/50 fixed right-3 top-3 z-50 rounded-lg border p-1 shadow-lg backdrop-blur-xl">
      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(v) => {
          if (v) setViewMode(v as ViewMode)
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="2d" size="sm" aria-label="2D View">
              <Grid2x2 className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>2D View</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="3d" size="sm" aria-label="3D View">
              <Box className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>3D View</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </div>
  )
}
