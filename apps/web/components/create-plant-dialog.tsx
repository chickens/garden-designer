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
import { Loader2, Sparkles } from "lucide-react"
import type {
  PlantDefinition,
  PlantCategory,
  SunRequirement,
  WaterRequirement,
} from "@/lib/types"

interface CreatePlantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (plant: PlantDefinition) => void
}

const CATEGORIES: { value: PlantCategory; label: string }[] = [
  { value: "shrub", label: "Shrub" },
  { value: "perennial", label: "Perennial" },
  { value: "annual", label: "Annual" },
  { value: "tree", label: "Tree" },
  { value: "climber", label: "Climber" },
  { value: "grass", label: "Grass" },
  { value: "bulb", label: "Bulb" },
  { value: "fern", label: "Fern" },
  { value: "herb", label: "Herb" },
  { value: "vegetable", label: "Vegetable" },
]

type Step = "name" | "details"

export function CreatePlantDialog({
  open,
  onOpenChange,
  onCreate,
}: CreatePlantDialogProps) {
  const [step, setStep] = React.useState<Step>("name")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Form state
  const [commonName, setCommonName] = React.useState("")
  const [botanicalName, setBotanicalName] = React.useState("")
  const [category, setCategory] = React.useState<PlantCategory>("perennial")
  const [heightMin, setHeightMin] = React.useState("30")
  const [heightMax, setHeightMax] = React.useState("60")
  const [spreadMin, setSpreadMin] = React.useState("30")
  const [spreadMax, setSpreadMax] = React.useState("45")
  const [sun, setSun] = React.useState<SunRequirement>("full")
  const [water, setWater] = React.useState<WaterRequirement>("medium")
  const [evergreen, setEvergreen] = React.useState(false)
  const [color, setColor] = React.useState("#4ade80")
  const [notes, setNotes] = React.useState("")

  function reset() {
    setStep("name")
    setLoading(false)
    setError(null)
    setCommonName("")
    setBotanicalName("")
    setCategory("perennial")
    setHeightMin("30")
    setHeightMax("60")
    setSpreadMin("30")
    setSpreadMax("45")
    setSun("full")
    setWater("medium")
    setEvergreen(false)
    setColor("#4ade80")
    setNotes("")
  }

  async function handleLookup() {
    if (!commonName.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/plant-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commonName: commonName.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Lookup failed")
      }

      const data = await res.json()

      // Populate form
      setCommonName(data.commonName ?? commonName)
      setBotanicalName(data.botanicalName ?? "")
      setCategory(data.category ?? "perennial")
      setHeightMin(String(data.heightMin ?? 30))
      setHeightMax(String(data.heightMax ?? 60))
      setSpreadMin(String(data.spreadMin ?? 30))
      setSpreadMax(String(data.spreadMax ?? 45))
      setSun(data.sun ?? "full")
      setWater(data.water ?? "medium")
      setEvergreen(data.evergreen ?? false)
      setColor(data.color ?? "#4ade80")
      setNotes(data.notes ?? "")
      setStep("details")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed")
      // Still allow manual entry
      setStep("details")
    } finally {
      setLoading(false)
    }
  }

  function handleSkip() {
    setStep("details")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!commonName.trim()) return

    const id = commonName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+$/, "")

    const plant: PlantDefinition = {
      id,
      commonName: commonName.trim(),
      botanicalName: botanicalName.trim(),
      category,
      height: {
        min: parseInt(heightMin) || 30,
        max: parseInt(heightMax) || 60,
      },
      spread: {
        min: parseInt(spreadMin) || 30,
        max: parseInt(spreadMax) || 45,
      },
      sun,
      water,
      soil: ["loam"],
      season: ["spring", "summer"],
      evergreen,
      color,
      notes,
    }

    onCreate(plant)
    onOpenChange(false)
    reset()
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset()
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Plant</DialogTitle>
        </DialogHeader>

        {step === "name" ? (
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cp-name" className="text-xs">
                Common Name
              </Label>
              <Input
                id="cp-name"
                value={commonName}
                onChange={(e) => setCommonName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleLookup()
                  }
                }}
                placeholder="e.g. Lavender, Japanese Maple..."
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                disabled={!commonName.trim() || loading}
              >
                Skip AI
              </Button>
              <Button
                type="button"
                onClick={handleLookup}
                disabled={!commonName.trim() || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Looking up...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Look Up
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cp-name2" className="text-xs">
                  Common Name
                </Label>
                <Input
                  id="cp-name2"
                  value={commonName}
                  onChange={(e) => setCommonName(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cp-botanical" className="text-xs">
                  Botanical Name
                </Label>
                <Input
                  id="cp-botanical"
                  value={botanicalName}
                  onChange={(e) => setBotanicalName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cp-category" className="text-xs">
                  Category
                </Label>
                <select
                  id="cp-category"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as PlantCategory)
                  }
                  className="border-border bg-background text-foreground h-9 rounded-lg border px-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cp-sun" className="text-xs">
                  Sun
                </Label>
                <select
                  id="cp-sun"
                  value={sun}
                  onChange={(e) =>
                    setSun(e.target.value as SunRequirement)
                  }
                  className="border-border bg-background text-foreground h-9 rounded-lg border px-2 text-sm"
                >
                  <option value="full">Full Sun</option>
                  <option value="partial">Partial</option>
                  <option value="shade">Shade</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cp-water" className="text-xs">
                  Water
                </Label>
                <select
                  id="cp-water"
                  value={water}
                  onChange={(e) =>
                    setWater(e.target.value as WaterRequirement)
                  }
                  className="border-border bg-background text-foreground h-9 rounded-lg border px-2 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Height Min (cm)</Label>
                <Input
                  type="number"
                  min="1"
                  value={heightMin}
                  onChange={(e) => setHeightMin(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Height Max (cm)</Label>
                <Input
                  type="number"
                  min="1"
                  value={heightMax}
                  onChange={(e) => setHeightMax(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Spread Min (cm)</Label>
                <Input
                  type="number"
                  min="1"
                  value={spreadMin}
                  onChange={(e) => setSpreadMin(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Spread Max (cm)</Label>
                <Input
                  type="number"
                  min="1"
                  value={spreadMax}
                  onChange={(e) => setSpreadMax(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="cp-color" className="text-xs">
                  Color
                </Label>
                <input
                  id="cp-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={evergreen}
                  onChange={(e) => setEvergreen(e.target.checked)}
                  className="accent-primary"
                />
                Evergreen
              </label>
            </div>

            {notes && (
              <p className="text-muted-foreground text-xs italic">{notes}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
