"use server"

import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { prds, roadmapEntries, specs, workItems } from "@/db/schema"
import { getCurrentUser } from "@/lib/session"
import { getWorkspaceSettings } from "@/lib/workspace"
import { applyStatusChange } from "@/lib/work-item-writes"
import {
  createWorkItemSchema,
  moveWorkItemSchema,
  type CreateWorkItemInput,
} from "@/lib/validation"

export async function createWorkItem(input: CreateWorkItemInput) {
  const user = await getCurrentUser()
  if (!user) return { error: "Not signed in" }

  const parsed = createWorkItemSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const { title, summary, priority, ownerId } = parsed.data

  // New items pick up the workspace default so a solo operator never has to
  // choose a repository for the common case.
  const { defaultRepositoryId } = await getWorkspaceSettings()

  const workItemId = await db.transaction(async (tx) => {
    // New cards land at the top of Planning; everything else shifts down.
    await tx
      .update(workItems)
      .set({ position: sql`${workItems.position} + 1` })
      .where(eq(workItems.status, "planning"))

    const [created] = await tx
      .insert(workItems)
      .values({
        title,
        summary: summary || null,
        priority,
        ownerId: ownerId || null,
        repositoryId: defaultRepositoryId,
        status: "planning",
        position: 0,
      })
      .returning({ id: workItems.id })

    // Every altitude gets a row up front so all three tabs are editable.
    await tx.insert(roadmapEntries).values({ workItemId: created.id })
    await tx.insert(prds).values({ workItemId: created.id })
    await tx.insert(specs).values({ workItemId: created.id })

    return created.id
  })

  revalidatePath("/board")
  return { ok: true, id: workItemId }
}

export async function moveWorkItem(input: {
  id: string
  status: string
  orderedIds: string[]
}) {
  const user = await getCurrentUser()
  if (!user) return { error: "Not signed in" }

  const parsed = moveWorkItemSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const result = await applyStatusChange(parsed.data, {
    type: "user",
    userId: user.id,
  })
  if ("error" in result) return result

  revalidatePath("/board")
  revalidatePath(`/work-items/${parsed.data.id}`)
  return { ok: true }
}
