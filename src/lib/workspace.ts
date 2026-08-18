import { count, eq } from "drizzle-orm"

import { db } from "@/db"
import { users, workspaceSettings } from "@/db/schema"
import type { WorkspaceMode } from "@/db/schema"

/**
 * Install-wide settings.
 *
 * Server-only — this imports `db`. Client components take `mode` as a prop
 * instead; importing this from one would pull the Postgres driver into the
 * browser bundle and break the production build.
 */

/** Fixed id for the single settings row, so creation is idempotent. */
export const WORKSPACE_SETTINGS_ID = "00000000-0000-4000-8000-000000000001"

export async function getWorkspaceSettings() {
  const existing = await db.query.workspaceSettings.findFirst()
  if (existing) return existing

  // onConflictDoNothing keeps two concurrent first reads from racing.
  await db
    .insert(workspaceSettings)
    .values({ id: WORKSPACE_SETTINGS_ID })
    .onConflictDoNothing()

  const created = await db.query.workspaceSettings.findFirst()
  if (!created) throw new Error("Could not initialise workspace settings")
  return created
}

export async function getWorkspaceMode(): Promise<WorkspaceMode> {
  return (await getWorkspaceSettings()).mode
}

/** True before the first account exists — used to offer the mode choice once. */
export async function isFirstRun() {
  const [row] = await db.select({ total: count() }).from(users)
  return (row?.total ?? 0) === 0
}

export async function setWorkspaceMode(mode: WorkspaceMode) {
  await getWorkspaceSettings()
  await db
    .update(workspaceSettings)
    .set({ mode, updatedAt: new Date() })
    .where(eq(workspaceSettings.id, WORKSPACE_SETTINGS_ID))
}

export async function setDefaultRepository(repositoryId: string | null) {
  await getWorkspaceSettings()
  await db
    .update(workspaceSettings)
    .set({ defaultRepositoryId: repositoryId, updatedAt: new Date() })
    .where(eq(workspaceSettings.id, WORKSPACE_SETTINGS_ID))
}

export async function setProductBrief(brief: {
  productName: string
  productAudience: string
  productStack: string
  productConventions: string
}) {
  await getWorkspaceSettings()
  const text = (v: string) => (v.trim() ? v.trim() : null)

  await db
    .update(workspaceSettings)
    .set({
      productName: text(brief.productName),
      productAudience: text(brief.productAudience),
      productStack: text(brief.productStack),
      productConventions: text(brief.productConventions),
      updatedAt: new Date(),
    })
    .where(eq(workspaceSettings.id, WORKSPACE_SETTINGS_ID))
}
