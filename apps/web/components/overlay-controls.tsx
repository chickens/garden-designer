"use client"

import * as React from "react"
import { Eye } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { useProject } from "@/lib/project-store"
import { PHASE_ORDER, PHASE_LABELS, type DesignPhase } from "@/lib/types"

const OVERLAYABLE_PHASES: DesignPhase[] = [
  "survey",
  "bubble",
  "concept",
  "detailed",
  "planting",
]

// Shared state for overlay visibility — used by canvases
const OverlayContext = React.createContext<Set<DesignPhase>>(new Set())

export function useOverlays(): Set<DesignPhase> {
  return React.useContext(OverlayContext)
}

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [overlays, setOverlays] = React.useState<Set<DesignPhase>>(new Set())

  return (
    <OverlayContext.Provider value={overlays}>
      <OverlaySetterContext.Provider value={setOverlays}>
        {children}
      </OverlaySetterContext.Provider>
    </OverlayContext.Provider>
  )
}

const OverlaySetterContext = React.createContext<
  React.Dispatch<React.SetStateAction<Set<DesignPhase>>>
>(() => {})

export function OverlayControls() {
  const { project, viewMode } = useProject()
  const overlays = React.useContext(OverlayContext)
  const setOverlays = React.useContext(OverlaySetterContext)
  const [open, setOpen] = React.useState(false)

  if (!project || viewMode === "3d") return null

  const activePhase = project.activePhase
  const availablePhases = OVERLAYABLE_PHASES.filter((p) => p !== activePhase)

  function toggle(phase: DesignPhase) {
    setOverlays((prev) => {
      const next = new Set(prev)
      if (next.has(phase)) {
        next.delete(phase)
      } else {
        next.add(phase)
      }
      return next
    })
  }

  const activeCount = availablePhases.filter((p) => overlays.has(p)).length

  return (
    <div className="bg-background/80 border-border/50 fixed right-24 top-3 z-50 rounded-lg border p-1 shadow-lg backdrop-blur-xl">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={activeCount > 0 || open ? "default" : "ghost"}
            size="icon-sm"
            onClick={() => setOpen(!open)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Layers</TooltipContent>
      </Tooltip>

      {open && (
        <div className="mt-1 flex flex-col gap-0.5 pt-1 border-t border-border/50">
          <p className="text-muted-foreground px-1 text-[10px] font-medium uppercase tracking-wider">
            Show layers
          </p>
          {availablePhases.map((phase) => (
            <button
              key={phase}
              onClick={() => toggle(phase)}
              className={`flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors ${
                overlays.has(phase)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full ${
                  overlays.has(phase) ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
              {PHASE_LABELS[phase]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
