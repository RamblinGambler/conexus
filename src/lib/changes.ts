import { db } from "@/db"
import { changeLogEntries } from "@/db/schema"

/**
 * Who made a change. Always resolved on the server from the session — the
 * client never supplies this, or anyone could forge agent attribution.
 *
 * `userId` is set for both types: the editor for `user`, and the person who
 * asked for or approved the change for `agent`.
 */
export type ChangeActor = {
  type: "user" | "agent"
  userId: string
}

export type FieldChange = {
  field: string
  oldValue: string | null
  newValue: string | null
}

function normalize(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Records only the fields that actually changed. No-ops are dropped. */
export async function recordChanges({
  workItemId,
  actor,
  why,
  changes,
}: {
  workItemId: string
  actor: ChangeActor
  why?: string | null
  changes: FieldChange[]
}) {
  const real = changes
    .map((c) => ({
      ...c,
      oldValue: normalize(c.oldValue),
      newValue: normalize(c.newValue),
    }))
    .filter((c) => c.oldValue !== c.newValue)

  if (real.length === 0) return

  await db.insert(changeLogEntries).values(
    real.map((c) => ({
      workItemId,
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      actorType: actor.type,
      actorUserId: actor.userId,
      why: normalize(why),
    }))
  )
}
