"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Button } from "@workspace/ui/components/button"

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string, widthMeters: number, depthMeters: number) => void
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreate,
}: NewProjectDialogProps) {
  const [name, setName] = React.useState("My Garden")
  const [width, setWidth] = React.useState("10")
  const [depth, setDepth] = React.useState("6")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const w = parseFloat(width)
    const d = parseFloat(depth)
    if (!name.trim() || isNaN(w) || isNaN(d) || w <= 0 || d <= 0) return
    onCreate(name.trim(), w, d)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Garden Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Garden Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="project-width">Width (m)</Label>
              <Input
                id="project-width"
                type="number"
                min="0.1"
                step="0.1"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-depth">Depth (m)</Label>
              <Input
                id="project-depth"
                type="number"
                min="0.1"
                step="0.1"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
