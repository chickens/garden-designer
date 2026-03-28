"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { Separator } from "@workspace/ui/components/separator"
import { Plus, Search, Leaf, Download, MousePointer2, Trash2, Hand } from "lucide-react"
import type { PlantDefinition } from "@/lib/types"
import {
  fetchLibraryIndex,
  fetchLibraryPlant,
} from "@/lib/plant-library"
import { CreatePlantDialog } from "./create-plant-dialog"

interface PlantPaletteProps {
  projectPlants: PlantDefinition[]
  selectedPlantId: string | null
  selectedPlacementId: string | null
  isSelectMode: boolean
  onSelectMode: () => void
  handMode: boolean
  isPanning: boolean
  onHandMode: () => void
  onSelectPlant: (plant: PlantDefinition) => void
  onAddPlantToProject: (plant: PlantDefinition) => void
  onCreatePlant: (plant: PlantDefinition) => void
  onDeletePlacement: () => void
}

export function PlantPalette({
  projectPlants,
  selectedPlantId,
  selectedPlacementId,
  isSelectMode,
  onSelectMode,
  handMode,
  isPanning,
  onHandMode,
  onSelectPlant,
  onAddPlantToProject,
  onCreatePlant,
  onDeletePlacement,
}: PlantPaletteProps) {
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [libraryIds, setLibraryIds] = React.useState<string[]>([])
  const [libraryPlants, setLibraryPlants] = React.useState<
    Map<string, PlantDefinition>
  >(new Map())
  const [search, setSearch] = React.useState("")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [loadingId, setLoadingId] = React.useState<string | null>(null)

  // Fetch library index on mount
  React.useEffect(() => {
    fetchLibraryIndex()
      .then(setLibraryIds)
      .catch(() => {})
  }, [])

  const projectPlantIds = new Set(projectPlants.map((p) => p.id))
  const availableLibraryIds = libraryIds.filter(
    (id) => !projectPlantIds.has(id)
  )

  const searchLower = search.toLowerCase()
  const filteredProject = projectPlants.filter(
    (p) =>
      !search ||
      p.commonName.toLowerCase().includes(searchLower) ||
      p.botanicalName.toLowerCase().includes(searchLower)
  )
  const filteredLibrary = availableLibraryIds.filter((id) => {
    if (!search) return true
    const plant = libraryPlants.get(id)
    if (plant) {
      return (
        plant.commonName.toLowerCase().includes(searchLower) ||
        plant.botanicalName.toLowerCase().includes(searchLower)
      )
    }
    return id.replace(/-/g, " ").includes(searchLower)
  })

  async function handleAddFromLibrary(id: string) {
    setLoadingId(id)
    try {
      let plant = libraryPlants.get(id)
      if (!plant) {
        plant = await fetchLibraryPlant(id)
        setLibraryPlants((prev) => new Map(prev).set(id, plant!))
      }
      onAddPlantToProject(plant)
      setPanelOpen(false)
    } catch {
      // Failed to fetch
    }
    setLoadingId(null)
  }

  function handleSelectProjectPlant(plant: PlantDefinition) {
    onSelectPlant(plant)
    setPanelOpen(false)
  }

  function getLibraryLabel(id: string): string {
    const plant = libraryPlants.get(id)
    if (plant) return plant.commonName
    return id
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  }

  return (
    <>
      {/* Thin icon toolbar */}
      <div className="bg-background/80 border-border/50 fixed left-3 top-16 z-50 flex flex-col items-center gap-1 rounded-lg border p-1 shadow-lg backdrop-blur-xl">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isSelectMode && !panelOpen ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => {
                onSelectMode()
                setPanelOpen(false)
              }}
            >
              <MousePointer2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Select</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={handMode || isPanning ? "default" : "ghost"}
              size="icon-sm"
              onClick={onHandMode}
            >
              <Hand className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Pan</TooltipContent>
        </Tooltip>

        <Separator className="w-5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={panelOpen || !isSelectMode ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setPanelOpen(!panelOpen)}
            >
              <Leaf className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Plants</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Create Plant</TooltipContent>
        </Tooltip>

        {selectedPlacementId && (
          <>
            <Separator className="w-5" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onDeletePlacement}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Delete</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Expandable plants panel — opens to the right */}
      {panelOpen && (
        <div
          className="bg-background/80 border-border/50 fixed left-14 top-16 z-50 flex w-48 flex-col gap-1 rounded-lg border p-2 shadow-lg backdrop-blur-xl"
          style={{ maxHeight: "calc(100vh - 120px)" }}
        >
          <div className="relative">
            <Search className="text-muted-foreground absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plants..."
              className="bg-muted/50 text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded px-2 py-1 pl-6 text-xs outline-none focus:ring-1"
              autoFocus
            />
          </div>

          <div
            className="overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 200px)" }}
          >
            {filteredProject.length > 0 && (
              <>
                <p className="text-muted-foreground mt-1 px-1 text-[10px] font-medium uppercase tracking-wider">
                  Project
                </p>
                {filteredProject.map((plant) => (
                  <button
                    key={plant.id}
                    onClick={() => handleSelectProjectPlant(plant)}
                    className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors ${
                      selectedPlantId === plant.id
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-accent/50"
                    }`}
                  >
                    <div
                      className="h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: plant.color }}
                    />
                    <span className="truncate">{plant.commonName}</span>
                    <span className="text-muted-foreground ml-auto text-[10px]">
                      {plant.spread.max}cm
                    </span>
                  </button>
                ))}
              </>
            )}

            {filteredLibrary.length > 0 && (
              <>
                <Separator className="my-1.5" />
                <p className="text-muted-foreground px-1 text-[10px] font-medium uppercase tracking-wider">
                  Library
                </p>
                {filteredLibrary.map((id) => (
                  <button
                    key={id}
                    onClick={() => handleAddFromLibrary(id)}
                    disabled={loadingId === id}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent/50 flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors"
                  >
                    <Leaf className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{getLibraryLabel(id)}</span>
                    <Download className="ml-auto h-3 w-3 flex-shrink-0 opacity-50" />
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <CreatePlantDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={onCreatePlant}
      />
    </>
  )
}
