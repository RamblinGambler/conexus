import { eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import { prds, roadmapEntries, specs, users, workItems } from "@/db/schema"
import type { WorkItemStatus } from "@/db/schema"
import { recordChanges, type ChangeActor, type FieldChange } from "@/lib/changes"
import { priorityLabel, statusLabel } from "@/lib/work-items"

/**
 * The write layer for work items.
 *
 * These functions deliberately live outside any `"use server"` module: every
 * export of a server-action file is callable by the browser, and these take an
 * `actor` argument. Exposing them directly would let a client forge agent
 * attribution. Server actions and the chat route wrap them instead, resolving
 * the actor from the session.
 */

function text(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Owner changes are logged by display name — a bare uuid says nothing. */
async function ownerLabels(ids: (string | null)[]) {
  const real = ids.filter((id): id is string => Boolean(id))
  if (real.length === 0) return new Map<string, string>()

  const rows = await db.query.users.findMany({
    where: inArray(users.id, real),
    columns: { id: true, name: true, email: true },
  })
  return new Map(rows.map((r) => [r.id, r.name ?? r.email]))
}

export async function applyWorkItemCore(
  input: {
    id: string
    title: string
    summary: string
    priority: "low" | "medium" | "high"
    ownerId: string
  },
  actor: ChangeActor,
  why?: string | null
) {
  const before = await db.query.workItems.findFirst({
    where: eq(workItems.id, input.id),
  })
  if (!before) return { error: "Work item not found" as const }

  const nextOwner = input.ownerId || null
  await db
    .update(workItems)
    .set({
      title: input.title,
      summary: text(input.summary),
      priority: input.priority,
      ownerId: nextOwner,
      updatedAt: new Date(),
    })
    .where(eq(workItems.id, input.id))

  const labels = await ownerLabels([before.ownerId, nextOwner])
  await recordChanges({
    workItemId: input.id,
    actor,
    why,
    changes: [
      { field: "title", oldValue: before.title, newValue: input.title },
      { field: "summary", oldValue: before.summary, newValue: text(input.summary) },
      {
        field: "priority",
        oldValue: priorityLabel(before.priority),
        newValue: priorityLabel(input.priority),
      },
      {
        field: "ownerId",
        oldValue: before.ownerId ? (labels.get(before.ownerId) ?? null) : "Unassigned",
        newValue: nextOwner ? (labels.get(nextOwner) ?? null) : "Unassigned",
      },
    ],
  })

  return { ok: true as const }
}

export async function applyStatusChange(
  {
    id,
    status,
    orderedIds,
  }: { id: string; status: WorkItemStatus; orderedIds: string[] },
  actor: ChangeActor,
  why?: string | null
) {
  const before = await db.query.workItems.findFirst({
    where: eq(workItems.id, id),
  })
  if (!before) return { error: "Work item not found" as const }

  await db.transaction(async (tx) => {
    await tx
      .update(workItems)
      .set({ status, updatedAt: new Date() })
      .where(eq(workItems.id, id))

    for (const [index, itemId] of orderedIds.entries()) {
      await tx
        .update(workItems)
        .set({ position: index })
        .where(eq(workItems.id, itemId))
    }
  })

  await recordChanges({
    workItemId: id,
    actor,
    why,
    changes: [
      {
        field: "status",
        oldValue: statusLabel(before.status),
        newValue: statusLabel(status),
      },
    ],
  })

  return { ok: true as const }
}

/** Shared shape for the three altitude tables. */
async function applyAltitude<T extends Record<string, string>>(
  {
    workItemId,
    values,
    current,
    write,
  }: {
    workItemId: string
    values: T
    current: Record<string, unknown> | undefined
    write: (next: Record<string, string | null>) => Promise<void>
  },
  actor: ChangeActor,
  why?: string | null
) {
  const next = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, text(v)])
  )
  await write(next)

  const changes: FieldChange[] = Object.keys(values).map((field) => ({
    field,
    oldValue: (current?.[field] as string | null) ?? null,
    newValue: next[field] ?? null,
  }))

  await recordChanges({ workItemId, actor, why, changes })
  return { ok: true as const }
}

export async function applyRoadmap(
  input: {
    workItemId: string
    targetTimeframe: string
    businessGoal: string
    why: string
  },
  actor: ChangeActor,
  why?: string | null
) {
  const { workItemId, ...values } = input
  const current = await db.query.roadmapEntries.findFirst({
    where: eq(roadmapEntries.workItemId, workItemId),
  })

  return applyAltitude(
    {
      workItemId,
      values,
      current,
      write: async (next) => {
        await db
          .update(roadmapEntries)
          .set({ ...next, updatedAt: new Date() })
          .where(eq(roadmapEntries.workItemId, workItemId))
      },
    },
    actor,
    why
  )
}

export async function applyPrd(
  input: {
    workItemId: string
    problemStatement: string
    goals: string
    inScope: string
    outOfScope: string
    successCriteria: string
  },
  actor: ChangeActor,
  why?: string | null
) {
  const { workItemId, ...values } = input
  const current = await db.query.prds.findFirst({
    where: eq(prds.workItemId, workItemId),
  })

  return applyAltitude(
    {
      workItemId,
      values,
      current,
      write: async (next) => {
        await db
          .update(prds)
          .set({ ...next, updatedAt: new Date() })
          .where(eq(prds.workItemId, workItemId))
      },
    },
    actor,
    why
  )
}

export async function applySpec(
  input: {
    workItemId: string
    technicalApproach: string
    designNotes: string
    acceptanceCriteria: string
  },
  actor: ChangeActor,
  why?: string | null
) {
  const { workItemId, ...values } = input
  const current = await db.query.specs.findFirst({
    where: eq(specs.workItemId, workItemId),
  })

  return applyAltitude(
    {
      workItemId,
      values,
      current,
      write: async (next) => {
        await db
          .update(specs)
          .set({ ...next, updatedAt: new Date() })
          .where(eq(specs.workItemId, workItemId))
      },
    },
    actor,
    why
  )
}
