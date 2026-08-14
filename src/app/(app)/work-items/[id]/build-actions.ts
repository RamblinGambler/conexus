"use server"

import { and, desc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { buildRuns, repositories, workItems } from "@/db/schema"
import { readBranchHead } from "@/lib/build/github"
import { tickBuildQueue } from "@/lib/build/queue"
import { getCurrentUser } from "@/lib/session"
import { applyStatusChange } from "@/lib/work-item-writes"

const ACTIVE: ("queued" | "running")[] = ["queued", "running"]

function branchNameFor(title: string, runId: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  return `conexus/${slug || "work-item"}-${runId.slice(0, 8)}`
}

export async function linkRepository(
  workItemId: string,
  repositoryId: string | null
) {
  const user = await getCurrentUser()
  if (!user) return { error: "Not signed in" }

  await db
    .update(workItems)
    .set({ repositoryId: repositoryId || null, updatedAt: new Date() })
    .where(eq(workItems.id, workItemId))

  revalidatePath(`/work-items/${workItemId}`)
  return { ok: true }
}

export async function startBuildRun(workItemId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: "Not signed in" }

  const item = await db.query.workItems.findFirst({
    where: eq(workItems.id, workItemId),
    with: { spec: true, prd: true },
  })
  if (!item) return { error: "Work item not found" }

  const hasSpec = Boolean(
    item.spec?.technicalApproach?.trim() ||
      item.spec?.acceptanceCriteria?.trim()
  )
  if (!hasSpec) {
    return { error: "Write a spec before starting a build" }
  }
  if (!item.repositoryId) {
    return { error: "Link a repository before starting a build" }
  }

  // The PRD rules out concurrent runs on one item.
  const active = await db.query.buildRuns.findFirst({
    where: and(
      eq(buildRuns.workItemId, workItemId),
      inArray(buildRuns.status, ACTIVE)
    ),
  })
  if (active) return { error: "A build is already running for this item" }

  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, item.repositoryId),
  })
  if (!repository) return { error: "The linked repository no longer exists" }

  // Queued, not started. The queue promotes it when nothing else is running,
  // so several items can be lined up and they go one at a time in this order.
  // `startedAt` is left for the moment the agent session actually exists.
  const [run] = await db
    .insert(buildRuns)
    .values({
      workItemId,
      repositoryId: repository.id,
      status: "queued",
      startedByUserId: user.id,
    })
    .returning({ id: buildRuns.id })

  const branchName = branchNameFor(item.title, run.id)
  await db
    .update(buildRuns)
    .set({ branchName })
    .where(eq(buildRuns.id, run.id))

  // Triggering a build moves the item into In Progress, recorded as an agent
  // change so it shows up in History like any other transition.
  const siblings = await db.query.workItems.findMany({
    where: eq(workItems.status, "in_progress"),
  })
  await applyStatusChange(
    {
      id: workItemId,
      status: "in_progress",
      orderedIds: [...siblings.map((s) => s.id), workItemId],
    },
    { type: "agent", userId: user.id },
    "Build started"
  )

  // Nudge the queue so a lone build starts now rather than waiting out the
  // tick interval. Deliberately not awaited — starting an agent session is a
  // network round trip, and the operator does not need to watch it happen.
  void tickBuildQueue()

  revalidatePath(`/work-items/${workItemId}`)
  revalidatePath("/board")
  revalidatePath("/builds")
  return { ok: true as const, runId: run.id }
}

/**
 * Queues another round on the pull request that already exists.
 *
 * The new run carries the parent's branch and pull request URL forward, which
 * is what keeps the agent on the same pull request instead of opening a second
 * one, and records the branch head so the queue can tell afterwards whether
 * anything actually changed.
 */
export async function requestChanges(workItemId: string, note: string) {
  const user = await getCurrentUser()
  if (!user) return { error: "Not signed in" }

  const trimmed = note.trim()
  if (!trimmed) return { error: "Describe what you want changed" }
  if (trimmed.length > 5000) return { error: "That note is too long" }

  const active = await db.query.buildRuns.findFirst({
    where: and(
      eq(buildRuns.workItemId, workItemId),
      inArray(buildRuns.status, ACTIVE)
    ),
  })
  if (active) return { error: "A build is already running for this item" }

  const parent = await db.query.buildRuns.findFirst({
    where: eq(buildRuns.workItemId, workItemId),
    orderBy: [desc(buildRuns.createdAt)],
    with: { repository: true },
  })
  if (!parent?.pullRequestUrl || !parent.branchName) {
    return { error: "There is no pull request to change yet" }
  }
  if (parent.prState === "merged") {
    return { error: "That pull request is already merged" }
  }
  if (!parent.repository) {
    return { error: "The linked repository no longer exists" }
  }

  // Captured now so the queue can tell a real iteration from one that changed
  // nothing — the pull request URL alone cannot.
  const baseSha = await readBranchHead(
    parent.repository.url,
    parent.branchName,
    parent.repository.encryptedToken
  ).catch(() => null)

  const [run] = await db
    .insert(buildRuns)
    .values({
      workItemId,
      repositoryId: parent.repositoryId,
      status: "queued",
      branchName: parent.branchName,
      pullRequestUrl: parent.pullRequestUrl,
      prNumber: parent.prNumber,
      prState: parent.prState,
      reviewNote: trimmed,
      parentRunId: parent.id,
      baseSha,
      startedByUserId: user.id,
    })
    .returning({ id: buildRuns.id })

  // Back to In Progress — it is being worked on again.
  const siblings = await db.query.workItems.findMany({
    where: eq(workItems.status, "in_progress"),
  })
  await applyStatusChange(
    {
      id: workItemId,
      status: "in_progress",
      orderedIds: [...siblings.map((s) => s.id), workItemId],
    },
    { type: "agent", userId: user.id },
    "Changes requested on the pull request"
  )

  void tickBuildQueue()

  revalidatePath(`/work-items/${workItemId}`)
  revalidatePath("/board")
  revalidatePath("/builds")
  return { ok: true as const, runId: run.id }
}

export async function latestBuildRun(workItemId: string) {
  const run = await db.query.buildRuns.findFirst({
    where: eq(buildRuns.workItemId, workItemId),
    orderBy: [desc(buildRuns.createdAt)],
  })
  return run ?? null
}
