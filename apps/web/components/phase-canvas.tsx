"use client"

import type { DesignPhase } from "@/lib/types"
import { GridView } from "./grid-view"
import { BubbleCanvas } from "./bubble-canvas"
import { SurveyCanvas } from "./survey-canvas"
import { PhasePlaceholder } from "./phase-placeholder"

export function PhaseCanvas({ phase }: { phase: DesignPhase }) {
  switch (phase) {
    case "survey":
      return <SurveyCanvas />
    case "bubble":
      return <BubbleCanvas />
    case "detailed":
      return <GridView />
    default:
      return <PhasePlaceholder phase={phase} />
  }
}
