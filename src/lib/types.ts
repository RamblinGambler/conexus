import type { WorkItemPriority, WorkItemStatus } from "@/db/schema"

export type BoardUser = {
  id: string
  name: string | null
  email: string
  image: string | null
}

export type BuildStatus = "queued" | "running" | "succeeded" | "failed"

export type BoardItem = {
  id: string
  title: string
  summary: string | null
  status: WorkItemStatus
  priority: WorkItemPriority
  ownerId: string | null
  position: number
  owner: BoardUser | null
  buildStatus: BuildStatus | null
}
