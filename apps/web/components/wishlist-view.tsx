"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { Plus, X } from "lucide-react"
import { useProject } from "@/lib/project-store"
import type { WishlistData, WishlistCategory, WishlistItem } from "@/lib/types"
import { DEFAULT_WISHLIST } from "@/lib/types"

export function WishlistView() {
  const { project, updatePhaseData } = useProject()

  const data: WishlistData =
    (project?.phases?.wishlist as WishlistData) ?? DEFAULT_WISHLIST

  const setData = React.useCallback(
    (newData: WishlistData) => {
      updatePhaseData("wishlist", newData)
    },
    [updatePhaseData]
  )

  const toggleItem = React.useCallback(
    (categoryId: string, itemId: string) => {
      setData({
        ...data,
        categories: data.categories.map((cat) =>
          cat.id === categoryId
            ? {
                ...cat,
                items: cat.items.map((item) =>
                  item.id === itemId
                    ? { ...item, checked: !item.checked }
                    : item
                ),
              }
            : cat
        ),
      })
    },
    [data, setData]
  )

  const addItem = React.useCallback(
    (categoryId: string, label: string) => {
      setData({
        ...data,
        categories: data.categories.map((cat) =>
          cat.id === categoryId
            ? {
                ...cat,
                items: [
                  ...cat.items,
                  {
                    id: crypto.randomUUID(),
                    label,
                    checked: true,
                  },
                ],
              }
            : cat
        ),
      })
    },
    [data, setData]
  )

  const removeItem = React.useCallback(
    (categoryId: string, itemId: string) => {
      setData({
        ...data,
        categories: data.categories.map((cat) =>
          cat.id === categoryId
            ? { ...cat, items: cat.items.filter((i) => i.id !== itemId) }
            : cat
        ),
      })
    },
    [data, setData]
  )

  const setNotes = React.useCallback(
    (notes: string) => {
      setData({ ...data, notes })
    },
    [data, setData]
  )

  return (
    <div className="flex h-full w-full items-start justify-center overflow-auto py-12">
      <div className="w-full max-w-xl px-6">
        <h2 className="text-foreground mb-1 text-lg font-semibold">Wishlist</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          What would you like in your garden? Tick everything that appeals, add
          your own, and jot down any notes.
        </p>

        {data.categories.map((category, catIndex) => (
          <React.Fragment key={category.id}>
            {catIndex > 0 && <Separator className="my-5" />}
            <CategorySection
              category={category}
              onToggle={(itemId) => toggleItem(category.id, itemId)}
              onAdd={(label) => addItem(category.id, label)}
              onRemove={(itemId) => removeItem(category.id, itemId)}
            />
          </React.Fragment>
        ))}

        <Separator className="my-5" />

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Notes
          </label>
          <textarea
            value={data.notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else? Budget, timeline, inspiration, must-haves..."
            rows={4}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1"
          />
        </div>

        <div className="h-12" />
      </div>
    </div>
  )
}

function CategorySection({
  category,
  onToggle,
  onAdd,
  onRemove,
}: {
  category: WishlistCategory
  onToggle: (itemId: string) => void
  onAdd: (label: string) => void
  onRemove: (itemId: string) => void
}) {
  const [adding, setAdding] = React.useState(false)
  const [newLabel, setNewLabel] = React.useState("")

  function handleAdd() {
    if (!newLabel.trim()) return
    onAdd(newLabel.trim())
    setNewLabel("")
    setAdding(false)
  }

  return (
    <div>
      <h3 className="text-foreground mb-3 text-sm font-medium">
        {category.name}
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {category.items.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            onToggle={() => onToggle(item.id)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
      </div>

      {adding ? (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd()
              if (e.key === "Escape") setAdding(false)
            }}
            placeholder="Add item..."
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring flex-1 rounded border px-2 py-1 text-sm outline-none focus:ring-1"
            autoFocus
          />
          <Button variant="ghost" size="icon-xs" onClick={handleAdd}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setAdding(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1 text-xs"
        >
          <Plus className="h-3 w-3" />
          Add custom
        </button>
      )}
    </div>
  )
}

function ChecklistItem({
  item,
  onToggle,
  onRemove,
}: {
  item: WishlistItem
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-accent">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={onToggle}
        className="accent-primary h-3.5 w-3.5 rounded"
      />
      <span
        className={`flex-1 text-sm ${item.checked ? "text-foreground" : "text-muted-foreground"}`}
      >
        {item.label}
      </span>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onRemove()
        }}
        className="text-muted-foreground hover:text-foreground hidden group-hover:block"
      >
        <X className="h-3 w-3" />
      </button>
    </label>
  )
}
