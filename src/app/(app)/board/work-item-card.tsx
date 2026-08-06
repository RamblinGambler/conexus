"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import Link from "next/link"

import { initialsFrom } from "@/components/user-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BoardItem } from "@/lib/types"
import { priorityLabel } from "@/lib/work-items"

const PRIORITY_VARIANT = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
} as const

const BUILD_VARIANT = {
  queued: "outline",
  running: "outline",
  succeeded: "secondary",
  failed: "destructive",
} as const

const BUILD_LABEL = {
  queued: "Build queued",
  running: "Building",
  succeeded: "PR open",
  failed: "Build failed",
} as const

export function WorkItemCardContent({
  item,
  dragging,
}: {
  item: BoardItem
  dragging?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-xs transition-shadow",
        dragging && "shadow-lg"
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical
          className="mt-0.5 size-4 shrink-0 cursor-grab text-muted-foreground"
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Link
            href={`/work-items/${item.id}`}
            className="text-sm leading-snug font-medium hover:underline"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {item.title}
          </Link>

          {item.summary ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {item.summary}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Badge variant={PRIORITY_VARIANT[item.priority]}>
                {priorityLabel(item.priority)}
              </Badge>
              {item.buildStatus ? (
                <Badge
                  variant={BUILD_VARIANT[item.buildStatus]}
                  data-testid="card-build-status"
                >
                  {BUILD_LABEL[item.buildStatus]}
                </Badge>
              ) : null}
            </div>
            {item.owner ? (
              <Avatar className="size-6" title={item.owner.name ?? item.owner.email}>
                {item.owner.image ? (
                  <AvatarImage src={item.owner.image} alt="" />
                ) : null}
                <AvatarFallback className="text-[10px]">
                  {initialsFrom(item.owner.name, item.owner.email)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span className="text-xs text-muted-foreground">Unassigned</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SortableWorkItemCard({ item }: { item: BoardItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      data-testid="work-item-card"
      data-item-id={item.id}
      {...attributes}
      {...listeners}
    >
      <WorkItemCardContent item={item} />
    </div>
  )
}
