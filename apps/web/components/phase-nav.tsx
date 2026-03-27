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
import { useProject } from "@/lib/project-store"
import { PHASE_ORDER, PHASE_LABELS, type DesignPhase } from "@/lib/types"

export function PhaseNav() {
  const { project, setActivePhase } = useProject()

  if (!project) return null

  return (
    <div className="bg-background/80 border-border/50 fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-lg border p-1 shadow-lg backdrop-blur-xl">
      <ToggleGroup
        type="single"
        value={project.activePhase}
        onValueChange={(v) => {
          if (v) setActivePhase(v as DesignPhase)
        }}
      >
        {PHASE_ORDER.map((phase) => (
          <Tooltip key={phase}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={phase}
                size="sm"
                aria-label={PHASE_LABELS[phase]}
                className="px-2.5 text-xs"
              >
                {PHASE_LABELS[phase]}
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{PHASE_LABELS[phase]}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </div>
  )
}
