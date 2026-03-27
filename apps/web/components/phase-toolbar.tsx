"use client"

import { useProject } from "@/lib/project-store"

export function PhaseToolbar() {
  const { project } = useProject()

  if (!project) return null

  // Each phase canvas renders its own toolbar inline.
  // This component is a placeholder for any shared phase toolbar UI.
  switch (project.activePhase) {
    default:
      return null
  }
}
