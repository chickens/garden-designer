"use client"

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
    <div className="bg-background/80 border-border/50 fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-0 rounded-lg border p-1 shadow-lg backdrop-blur-xl">
      {PHASE_ORDER.map((phase) => {
        const isActive = project.activePhase === phase
        return (
          <Tooltip key={phase}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActivePhase(phase as DesignPhase)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {PHASE_LABELS[phase]}
              </button>
            </TooltipTrigger>
            <TooltipContent>{PHASE_LABELS[phase]}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
