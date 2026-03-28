"use client"

import type { DesignPhase } from "@/lib/types"
import { DetailCanvas } from "./detail-canvas"
import { BubbleCanvas } from "./bubble-canvas"
import { SurveyCanvas } from "./survey-canvas"
import { ConceptCanvas } from "./concept-canvas"
import { WishlistView } from "./wishlist-view"
import { PlantingCanvas } from "./planting-canvas"
import { PhasePlaceholder } from "./phase-placeholder"

export function PhaseCanvas({ phase }: { phase: DesignPhase }) {
  switch (phase) {
    case "survey":
      return <SurveyCanvas />
    case "wishlist":
      return <WishlistView />
    case "bubble":
      return <BubbleCanvas />
    case "concept":
      return <ConceptCanvas />
    case "detailed":
      return <DetailCanvas />
    case "planting":
      return <PlantingCanvas />
    default:
      return <PhasePlaceholder phase={phase} />
  }
}
