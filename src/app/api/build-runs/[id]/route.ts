import { eq } from "drizzle-orm"

import { db } from "@/db"
import { buildRuns } from "@/db/schema"
import { getCurrentUser } from "@/lib/session"

/**
 * Reads the current state of a run, for the build panel.
 *
 * Read-only on purpose. This route used to advance the run itself — calling
 * `syncBuild()`, persisting the transition, and moving the item to In Review
 * using whoever's tab happened to be open as the actor. The queue in
 * `src/lib/build/queue.ts` is now the only writer, which is what lets a run
 * finish with no tab open at all, and stops two of these racing each other.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/build-runs/[id]">
) {
  const { id } = await ctx.params

  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 })
  }

  const run = await db.query.buildRuns.findFirst({
    where: eq(buildRuns.id, id),
  })
  if (!run) {
    return Response.json({ error: "Build run not found" }, { status: 404 })
  }

  return Response.json({ run })
}
