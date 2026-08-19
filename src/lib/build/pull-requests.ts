import { desc, eq, isNotNull } from "drizzle-orm"

import { db } from "@/db"
import { buildRuns, workItems } from "@/db/schema"
import { parsePullRequestUrl, readPullRequest } from "@/lib/build/github"
import { applyStatusChange } from "@/lib/work-item-writes"

/**
 * How stale a cached pull request state may be before it is refreshed.
 *
 * The queue ticks every 10s, which is right for a build that is actively
 * running and far too eager for a pull request sitting open waiting on a
 * human to look at it.
 */
const REFRESH_AFTER_MS = 60_000

/**
 * Refreshes pull request state for work still being reviewed, and moves an
 * item to Done once its pull request is merged.
 *
 * Only the newest run per work item is polled. A rebuild copies its parent's
 * branch and pull request URL forward, so the newest run always carries the
 * current pull request and the ones behind it are history.
 */
export async function syncPullRequests() {
  const runs = await db.query.buildRuns.findMany({
    where: isNotNull(buildRuns.pullRequestUrl),
    orderBy: [desc(buildRuns.createdAt)],
    with: {
      repository: true,
      workItem: { columns: { id: true, status: true } },
    },
  })

  const seen = new Set<string>()

  for (const run of runs) {
    // Newest first, so the first row for an item is the one that counts.
    if (seen.has(run.workItemId)) continue
    seen.add(run.workItemId)

    if (!run.repository || !run.pullRequestUrl) continue
    if (run.workItem?.status === "done") continue
    if (
      run.prCheckedAt &&
      Date.now() - run.prCheckedAt.getTime() < REFRESH_AFTER_MS
    ) {
      continue
    }

    const snapshot = await readPullRequest(
      run.pullRequestUrl,
      run.repository.encryptedToken
    ).catch(() => null)

    // Stamped even when the read fails, so an unreadable pull request is
    // retried on the normal cadence rather than on every tick.
    await db
      .update(buildRuns)
      .set({
        prCheckedAt: new Date(),
        ...(snapshot && {
          prState: snapshot.state,
          prChecks: snapshot.checks,
          prNumber: parsePullRequestUrl(run.pullRequestUrl)?.number,
        }),
      })
      .where(eq(buildRuns.id, run.id))

    // Merging is what finishes the work. Guarded on the previously stored
    // state so re-ticking cannot write the history row twice.
    const newlyMerged = snapshot?.state === "merged" && run.prState !== "merged"
    if (newlyMerged && run.startedByUserId) {
      const siblings = await db.query.workItems.findMany({
        where: eq(workItems.status, "done"),
      })
      await applyStatusChange(
        {
          id: run.workItemId,
          status: "done",
          orderedIds: [...siblings.map((s) => s.id), run.workItemId],
        },
        { type: "agent", userId: run.startedByUserId },
        "Pull request merged"
      )
    }
  }
}
