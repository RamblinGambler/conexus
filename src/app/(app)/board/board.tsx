"use client"

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { moveWorkItem } from "@/app/(app)/board/actions"
import { BoardColumn } from "@/app/(app)/board/board-column"
import { NewWorkItemDialog } from "@/app/(app)/board/new-work-item-dialog"
import { WorkItemCardContent } from "@/app/(app)/board/work-item-card"
import { Button } from "@/components/ui/button"
import type { WorkItemStatus, WorkspaceMode } from "@/db/schema"
import type { BoardItem, BoardUser } from "@/lib/types"
import { STATUS_VALUES, WORK_ITEM_STATUSES } from "@/lib/work-items"

function isStatus(value: string): value is WorkItemStatus {
  return (STATUS_VALUES as readonly string[]).includes(value)
}

export function Board({
  items,
  users,
  mode,
}: {
  items: BoardItem[]
  users: BoardUser[]
  mode: WorkspaceMode
}) {
  const [cards, setCards] = useState(items)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Re-sync when the server sends fresh data (a create, or another user's move).
  const [lastServerItems, setLastServerItems] = useState(items)
  if (lastServerItems !== items) {
    setLastServerItems(items)
    setCards(items)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const byStatus = (status: WorkItemStatus) =>
    cards.filter((c) => c.status === status)

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeCard = cards.find((c) => c.id === active.id)
    if (!activeCard) return

    // Dropping on a column uses the column id; dropping on a card uses its id.
    const overId = String(over.id)
    const overCard = cards.find((c) => c.id === overId)
    const destination: WorkItemStatus = isStatus(overId)
      ? overId
      : (overCard?.status ?? activeCard.status)

    const previous = cards

    // Rebuild the destination column with the dragged card inserted at the
    // drop point (appended when dropped on empty column space).
    const withoutActive = cards.filter(
      (c) => c.status === destination && c.id !== activeCard.id
    )
    const insertAt = overCard
      ? withoutActive.findIndex((c) => c.id === overCard.id)
      : -1
    const finalOrder = [...withoutActive]
    finalOrder.splice(insertAt === -1 ? finalOrder.length : insertAt, 0, activeCard)

    const unchanged =
      activeCard.status === destination &&
      finalOrder.map((c) => c.id).join() ===
        byStatus(destination)
          .map((c) => c.id)
          .join()
    if (unchanged) return

    setCards((current) => [
      ...current.filter(
        (c) => c.status !== destination && c.id !== activeCard.id
      ),
      ...finalOrder.map((c, index) => ({
        ...c,
        status: destination,
        position: index,
      })),
    ])

    const result = await moveWorkItem({
      id: activeCard.id,
      status: destination,
      orderedIds: finalOrder.map((c) => c.id),
    })

    if (result?.error) {
      setCards(previous)
      toast.error(result.error)
    }
  }

  const activeCard = cards.find((c) => c.id === activeId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
          <p className="text-muted-foreground">
            Every work item, at every altitude.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mode === "solo" ? (
            <Button asChild data-testid="start-something-new">
              <Link href="/new">
                <Sparkles className="size-4" />
                Start something new
              </Link>
            </Button>
          ) : null}
          <NewWorkItemDialog users={users} />
        </div>
      </div>

      <DndContext
        // Stable id — without it dnd-kit derives its aria-describedby from a
        // global counter that differs between server and client, which trips
        // a hydration mismatch.
        id="conexus-board"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {WORK_ITEM_STATUSES.map(({ value, label }) => (
            <BoardColumn
              key={value}
              status={value}
              label={label}
              items={byStatus(value)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <WorkItemCardContent item={activeCard} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
