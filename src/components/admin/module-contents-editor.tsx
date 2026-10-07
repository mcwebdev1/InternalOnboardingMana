"use client"

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type ContentDraft = {
  id: string
  title: string
  url: string
  description: string
}

export function createContentDraft(
  partial?: Partial<ContentDraft>
): ContentDraft {
  return {
    id: partial?.id ?? crypto.randomUUID(),
    title: partial?.title ?? "",
    url: partial?.url ?? "",
    description: partial?.description ?? "",
  }
}

export function ModuleContentsEditor({
  items,
  onChange,
}: {
  items: ContentDraft[]
  onChange: (items: ContentDraft[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(items, oldIndex, newIndex))
  }

  function updateItem(id: string, patch: Partial<ContentDraft>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>Contents</Label>
        <Button
          type="button"
          variant="outline"
          className="h-11 cursor-pointer px-3"
          onClick={() => onChange([...items, createContentDraft()])}
        >
          <Plus className="size-4" />
          Add URL
        </Button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Drag the handle to change the order interns see. Title is required. Description is optional.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {items.map((item, index) => (
              <SortableContentItem
                key={item.id}
                item={item}
                index={index}
                canRemove={items.length > 1}
                onChange={updateItem}
                onRemove={() => onChange(items.filter((current) => current.id !== item.id))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableContentItem({
  item,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  item: ContentDraft
  index: number
  canRemove: boolean
  onChange: (id: string, patch: Partial<ContentDraft>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "grid gap-2 rounded-xl bg-muted/40 p-3 ring-1 ring-transparent",
        isDragging && "z-10 bg-muted ring-foreground/15"
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex size-11 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag content ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <Input
          aria-label={`Content ${index + 1} title`}
          placeholder="Title"
          value={item.title}
          required
          className="h-11"
          onChange={(event) => onChange(item.id, { title: event.target.value })}
        />
        <Button
          type="button"
          variant="destructive"
          className="h-11 cursor-pointer px-3"
          onClick={onRemove}
          disabled={!canRemove}
        >
          <Trash2 className="size-4" />
          <span className="sr-only">Remove content {index + 1}</span>
        </Button>
      </div>
      <Input
        aria-label={`Content ${index + 1} URL`}
        placeholder="https://"
        value={item.url}
        className="h-11"
        onChange={(event) => onChange(item.id, { url: event.target.value })}
      />
      <Textarea
        aria-label={`Content ${index + 1} description`}
        placeholder="Description (optional)"
        value={item.description}
        className="min-h-16"
        onChange={(event) => onChange(item.id, { description: event.target.value })}
      />
    </li>
  )
}
