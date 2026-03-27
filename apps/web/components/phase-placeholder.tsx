"use client"

import { PHASE_LABELS, type DesignPhase } from "@/lib/types"

export function PhasePlaceholder({ phase }: { phase: DesignPhase }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-muted-foreground text-center">
        <p className="text-lg font-medium">{PHASE_LABELS[phase]}</p>
        <p className="text-sm">Coming soon</p>
      </div>
    </div>
  )
}
