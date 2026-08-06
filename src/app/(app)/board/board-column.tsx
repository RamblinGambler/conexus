"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

import { SortableWorkItemCard } from "@/app/(app)/board/work-item-card"
import { cn } from "@/lib/utils"
import type { BoardItem } from "@/lib/types"
import type { WorkItemStatus } from "@/db/schema"

export function BoardColumn({
  status,
  label,
  items,
}: {
  status: WorkItemStatus
  label: string
  items: BoardItem[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex min-w-56 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-medium">{label}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>

      <div
        ref={setNodeRef}
        data-testid={`column-${status}`}
        className={cn(
          "flex min-h-40 flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
          isOver ? "border-primary bg-accent/50" : "bg-muted/30"
        )}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableWorkItemCard key={item.id} item={item} />
          ))}
        </SortableContext>

        {items.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Nothing here yet
          </p>
        ) : null}
      </div>
    </div>
  )
}
