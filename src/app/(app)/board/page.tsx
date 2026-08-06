import { asc, desc } from "drizzle-orm"
import { redirect } from "next/navigation"

import { Board } from "@/app/(app)/board/board"
import { db } from "@/db"
import { buildRuns, users, workItems } from "@/db/schema"
import { getCurrentUser } from "@/lib/session"
import { getWorkspaceMode } from "@/lib/workspace"
import type { BuildStatus } from "@/lib/types"

export default async function BoardPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/signed-out")
  }

  const mode = await getWorkspaceMode()

  const [items, allUsers, runs] = await Promise.all([
    db.query.workItems.findMany({
      orderBy: [asc(workItems.position), asc(workItems.createdAt)],
      with: { owner: { columns: { id: true, name: true, email: true, image: true } } },
    }),
    db.query.users.findMany({
      columns: { id: true, name: true, email: true, image: true },
      orderBy: [asc(users.name)],
    }),
    db.query.buildRuns.findMany({
      columns: { workItemId: true, status: true, createdAt: true },
      orderBy: [desc(buildRuns.createdAt)],
    }),
  ])

  // Newest run per item — the board only shows the latest build's state.
  const latestByItem = new Map<string, BuildStatus>()
  for (const run of runs) {
    if (!latestByItem.has(run.workItemId)) {
      latestByItem.set(run.workItemId, run.status)
    }
  }

  return (
    <Board
      items={items.map((item) => ({
        ...item,
        buildStatus: latestByItem.get(item.id) ?? null,
      }))}
      users={allUsers}
      mode={mode}
    />
  )
}
