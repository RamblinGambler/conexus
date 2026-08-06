import type { WorkItemPriority, WorkItemStatus } from "@/db/schema"

export const WORK_ITEM_STATUSES: { value: WorkItemStatus; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "ready", label: "Ready" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
]

export const STATUS_VALUES = WORK_ITEM_STATUSES.map((s) => s.value) as [
  WorkItemStatus,
  ...WorkItemStatus[],
]

export const WORK_ITEM_PRIORITIES: {
  value: WorkItemPriority
  label: string
}[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

export const PRIORITY_VALUES = WORK_ITEM_PRIORITIES.map((p) => p.value) as [
  WorkItemPriority,
  ...WorkItemPriority[],
]

export function statusLabel(status: WorkItemStatus) {
  return WORK_ITEM_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function priorityLabel(priority: WorkItemPriority) {
  return WORK_ITEM_PRIORITIES.find((p) => p.value === priority)?.label ?? priority
}
