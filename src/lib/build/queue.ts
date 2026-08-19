import { eq, sql } from "drizzle-orm"

import { db } from "@/db"
import { buildRuns, workItems } from "@/db/schema"
import { readBranchHead } from "@/lib/build/github"
import { syncPullRequests } from "@/lib/build/pull-requests"
import {
  buildIsStubbed,
  resumeBuild,
  startBuild,
  stubSync,
  syncBuild,
} from "@/lib/build/runner"
import { sendBuildFinishedEmail } from "@/lib/resend"
import { applyStatusChange } from "@/lib/work-item-writes"
import { getWorkspaceSettings } from "@/lib/workspace"

/**
 * How long a run may sit `running` with no session before it is written off.
 *
 * A run is claimed before its agent session exists, so a process that dies in
 * that window leaves a row nothing will ever advance — and because only one
 * run may be active at a time, that row blocks the whole queue.
 */
const START_TIMEOUT_MS = 2 * 60 * 1000

/**
 * Guards the ticker against overlapping itself. The SQL claim below is what
 * guards against every *other* caller (the cron route, an enqueue) — this only
 * stops one slow tick from being re-entered by the next interval.
 */
let ticking = false

type ActiveRun = typeof buildRuns.$inferSelect

async function notify(run: ActiveRun, succeeded: boolean) {
  if (run.notifiedAt) return

  const details = await db.query.buildRuns.findFirst({
    where: eq(buildRuns.id, run.id),
    with: { workItem: { columns: { title: true } }, startedBy: true },
  })

  const to = details?.startedBy?.email
  if (to) {
    try {
      await sendBuildFinishedEmail({
        to,
        workItemId: run.workItemId,
        workItemTitle: details?.workItem?.title ?? "Untitled work item",
        succeeded,
        pullRequestUrl: run.pullRequestUrl,
        outputSummary: run.outputSummary,
      })
    } catch (error) {
      // Deliberately swallowed. `notifiedAt` is stamped either way below, so a
      // broken mail config costs one email rather than re-notifying forever.
      console.error("[build-queue] could not send completion email", error)
    }
  }

  await db
    .update(buildRuns)
    .set({ notifiedAt: new Date() })
    .where(eq(buildRuns.id, run.id))
}

/** Marks a run terminal, moves the item on success, and emails either way. */
async function finish(
  run: ActiveRun,
  next: { status: "succeeded" | "failed"; pullRequestUrl: string | null; outputSummary: string | null }
) {
  const [updated] = await db
    .update(buildRuns)
    .set({
      status: next.status,
      pullRequestUrl: next.pullRequestUrl ?? run.pullRequestUrl,
      outputSummary: next.outputSummary ?? run.outputSummary,
      finishedAt: new Date(),
    })
    .where(eq(buildRuns.id, run.id))
    .returning()

  // A successful build means there is a pull request to look at, so the item
  // moves to In Review — attributed to whoever started the run, since there is
  // no request and no session out here.
  if (next.status === "succeeded" && updated.startedByUserId) {
    const siblings = await db.query.workItems.findMany({
      where: eq(workItems.status, "in_review"),
    })
    await applyStatusChange(
      {
        id: run.workItemId,
        status: "in_review",
        orderedIds: [...siblings.map((s) => s.id), run.workItemId],
      },
      { type: "agent", userId: updated.startedByUserId },
      "Build succeeded and opened a pull request"
    )
  }

  await notify(updated, next.status === "succeeded")
}

/** Advances the run that is currently active, if there is one. */
async function syncActive() {
  const run = await db.query.buildRuns.findFirst({
    where: eq(buildRuns.status, "running"),
    with: { repository: true },
  })
  if (!run) return

  // Claimed but the session was never created — see START_TIMEOUT_MS.
  if (!buildIsStubbed && !run.sessionId) {
    const age = Date.now() - (run.startedAt?.getTime() ?? 0)
    if (age > START_TIMEOUT_MS) {
      await finish(run, {
        status: "failed",
        pullRequestUrl: null,
        outputSummary: "Build did not start",
      })
    }
    return
  }

  let next
  try {
    next = buildIsStubbed
      ? stubSync(run.status, {
          repositoryUrl: run.repository?.url ?? "https://github.com/unknown/repo",
          branchName: run.branchName ?? "conexus/build",
        })
      : await syncBuild(run.sessionId)
  } catch (error) {
    next = {
      status: "failed" as const,
      pullRequestUrl: null,
      outputSummary:
        error instanceof Error ? error.message : "Could not read build status",
    }
  }

  // Still going — record whatever progress it has reported and leave it.
  if (next.status !== "succeeded" && next.status !== "failed") {
    await db
      .update(buildRuns)
      .set({
        pullRequestUrl: next.pullRequestUrl ?? run.pullRequestUrl,
        outputSummary: next.outputSummary ?? run.outputSummary,
      })
      .where(eq(buildRuns.id, run.id))
    return
  }

  await finish(run, await judge(run, next))
}

/**
 * Decides what a finished run actually achieved.
 *
 * For a first build, finding a pull request URL is the right test. For a
 * rebuild it is not: the URL from the turn that opened the pull request is
 * still sitting in the same session's transcript, so a retry that changed
 * nothing would still look like a success. A rebuild is judged on whether the
 * branch head moved — which is also precisely what the operator was promised,
 * the same branch updated with a new commit.
 */
async function judge(
  run: typeof buildRuns.$inferSelect & {
    repository?: { url: string; encryptedToken: string } | null
  },
  next: { status: string; pullRequestUrl: string | null; outputSummary: string | null }
): Promise<{
  status: "succeeded" | "failed"
  pullRequestUrl: string | null
  outputSummary: string | null
}> {
  const base = {
    pullRequestUrl: next.pullRequestUrl,
    outputSummary: next.outputSummary,
  }

  if (!run.reviewNote || next.status === "failed") {
    return { ...base, status: next.status === "failed" ? "failed" : "succeeded" }
  }

  if (!run.repository || !run.branchName || !run.baseSha) {
    return { ...base, status: "succeeded" }
  }

  const head = await readBranchHead(
    run.repository.url,
    run.branchName,
    run.repository.encryptedToken
  ).catch(() => null)

  if (head && head !== run.baseSha) return { ...base, status: "succeeded" }

  return {
    ...base,
    status: "failed",
    outputSummary: [
      next.outputSummary,
      `No new commit landed on ${run.branchName} — the pull request is unchanged.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  }
}

/**
 * Claims the oldest queued run, but only when nothing is running.
 *
 * Written as one statement on purpose. Reading "is anything running?" and then
 * writing leaves a window where two callers both see an idle queue and both
 * start a build — the concurrency the PRD rules out. The `NOT EXISTS` makes
 * the check and the claim the same operation.
 */
async function claimNext() {
  const claimed = await db.execute<{ id: string }>(sql`
    UPDATE build_run SET status = 'running', started_at = now()
    WHERE id = (
      SELECT id FROM build_run WHERE status = 'queued'
      ORDER BY created_at ASC LIMIT 1
    )
    AND NOT EXISTS (SELECT 1 FROM build_run WHERE status = 'running')
    RETURNING id
  `)

  const id = claimed[0]?.id
  if (!id) return

  const run = await db.query.buildRuns.findFirst({
    where: eq(buildRuns.id, id),
    with: {
      repository: true,
      workItem: { with: { spec: true, prd: true } },
      parent: { columns: { sessionId: true } },
    },
  })
  if (!run) return
  // Routed through `finish` rather than a bare update so it is emailed like
  // any other failure — a run that dies here would otherwise end in silence,
  // which is the one thing an unattended queue must never do.
  if (!run.repository || !run.workItem) {
    await finish(run, {
      status: "failed",
      pullRequestUrl: null,
      outputSummary: "The linked repository no longer exists",
    })
    return
  }

  try {
    const ctx = {
      product: await getWorkspaceSettings(),
      workItemTitle: run.workItem.title,
      workItemSummary: run.workItem.summary,
      spec: run.workItem.spec ?? null,
      prd: run.workItem.prd ?? null,
      repository: run.repository,
      branchName: run.branchName ?? "conexus/build",
    }

    // A review note is what makes this an iteration rather than a fresh start:
    // it goes back to the agent that opened the pull request, on the same
    // branch, instead of building the whole thing again.
    const sessionId = run.reviewNote
      ? await resumeBuild({
          ...ctx,
          reviewNote: run.reviewNote,
          parentSessionId: run.parent?.sessionId ?? null,
          pullRequestUrl: run.pullRequestUrl,
        })
      : await startBuild(ctx)

    await db
      .update(buildRuns)
      .set({ sessionId })
      .where(eq(buildRuns.id, id))
  } catch (error) {
    // One bad run must not wedge the queue — mark it and let the next tick
    // promote whatever is behind it.
    await finish(run, {
      status: "failed",
      pullRequestUrl: null,
      outputSummary:
        error instanceof Error ? error.message : "Could not start the build",
    })
  }
}

/**
 * One pass over the build queue: advance whatever is running, then start the
 * next thing if the queue is now free.
 *
 * Safe to call from anywhere and at any frequency — the interval in
 * `src/instrumentation.ts`, the cron route, or an enqueue wanting its build to
 * begin immediately.
 */
export async function tickBuildQueue() {
  if (ticking) return
  ticking = true
  try {
    await syncActive()
    await claimNext()
    // Reuses the ticker rather than adding a second scheduler. Its own
    // staleness floor keeps it from calling GitHub on every pass.
    await syncPullRequests()
  } catch (error) {
    console.error("[build-queue] tick failed", error)
  } finally {
    ticking = false
  }
}
