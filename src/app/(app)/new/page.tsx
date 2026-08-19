import { asc } from "drizzle-orm"
import { redirect } from "next/navigation"

import { GuidedFlow } from "@/app/(app)/new/guided-flow"
import { db } from "@/db"
import { repositories } from "@/db/schema"
import { getCurrentUser } from "@/lib/session"
import { getWorkspaceSettings } from "@/lib/workspace"

export default async function NewWorkPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/signed-out")
  }

  const settings = await getWorkspaceSettings()

  // No single role can finish this path in team mode — the interview is
  // PM-only and spec generation is engineer/designer-only — so it is not
  // offered there rather than breaking partway through.
  if (settings.mode !== "solo") {
    redirect("/board")
  }

  const repos = await db.query.repositories.findMany({
    columns: { id: true, name: true },
    orderBy: [asc(repositories.name)],
  })

  return (
    <GuidedFlow
      repositories={repos}
      defaultRepositoryId={settings.defaultRepositoryId}
    />
  )
}
